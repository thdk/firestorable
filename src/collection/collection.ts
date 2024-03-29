import { addAsync, getAsync } from '../__test-utils__/firestore';
import {
    observable,
    reaction,
    transaction,
    onBecomeObserved,
    onBecomeUnobserved,
    computed,
    when,
    makeObservable,
} from "mobx";

import { Doc } from "../document";
import {
    collection,
    CollectionReference,
    deleteDoc,
    doc,
    Firestore,
    getDocs,
    onSnapshot,
    PartialWithFieldValue,
    query as firestoryQuery,
    Query,
    QueryConstraint,
    QuerySnapshot,
    SetOptions,
    updateDoc,
    writeBatch
} from "firebase/firestore";

export interface IDisposable {
    dispose: () => void;
}

export type GetOptions = {
    readonly watch?: boolean;
}

export enum RealtimeMode {
    on = 0,
    off = 1,
}

export enum FetchMode {
    /**
     * (Re)fetch the documents each time the collection becomes observed
     * and also refetches when the query changes after documents have been fetched
     */
    auto = 0,
    /**
    * Only fetches when calling fetchAsync explicitly
    */
    manual = 1,
    /**
     * Fetches once when creating the collection. Refetches when the query changes after documents have been fetched
     */
    once = 2,
}

export interface ICollectionOptions<T, K> {
    realtimeMode?: RealtimeMode;
    fetchMode?: FetchMode;
    query?: ((ref: CollectionReference<K>) => Query<K>) | null;
    deserialize?: (firestoreData: K) => T;
    serialize?: (appData: Partial<T> | null) => PartialWithFieldValue<K>;
    name?: string;
    defaultSetOptions?: SetOptions;
}

export interface ICollectionDependencies {
    logger?: (log: string, severity: "info" | "warning" | "error") => void;
}

export interface ICollection<T, K = T> extends Collection<T, K> { }

export class Collection<T, K = T> {
    private docsContainer = {
        docs: observable<string, Doc<T, K>>(new Map)
    };

    private isObserved = false;
    private name: string;

    public query?: ICollectionOptions<T, K>["query"];

    /** 'false' until documents are received for the current query */
    public isFetched: boolean = false;

    /** 'true' whenever getDocs is fired and 'false' after receiving first snapshot. */
    public isLoading: boolean = false;

    private numberOfObservers: number = 0;

    private readonly collectionRef: CollectionReference<K>;
    private readonly realtimeMode: RealtimeMode;
    private readonly fetchMode: FetchMode;

    private snapshotDisposable?: () => void;
    private disposables: (() => void)[] = [];

    private readonly deserialize: (firestoreData: K) => T;
    private readonly serialize: (appData: Partial<T> | null) => PartialWithFieldValue<K>;
    private readonly firestore: Firestore;
    private readonly logger: ICollectionDependencies["logger"];

    private defaultSetOptions?: ICollectionOptions<T, K>["defaultSetOptions"];

    constructor(
        firestore: Firestore,
        collectionId: (() => CollectionReference<K>) | string | CollectionReference<K>,
        options: ICollectionOptions<T, K> = {},
        dependencies: ICollectionDependencies = {},
    ) {
        makeObservable<Collection<T, K>, "docsContainer">(this, {
            docsContainer: observable,
            query: observable.ref,
            isFetched: observable,
            isLoading: observable,
            docs: computed
        });

        const {
            realtimeMode = RealtimeMode.on,
            fetchMode = FetchMode.auto,
            query,
            deserialize = (x: K) => x as unknown as T,
            serialize = (x: Partial<T> | null) => x as unknown as PartialWithFieldValue<K>,
            name,
            defaultSetOptions,
        } = options;

        if (typeof collectionId === "string") {
            this.collectionRef = collection(firestore, collectionId) as unknown as CollectionReference<K>;
        } else if (typeof collectionId === "function") {
            this.collectionRef = collectionId();
        } else {
            this.collectionRef = collectionId;
        }

        // Name is used to identify this collection in logs and debug sessions.
        // Useful in case multiple firestorable collections are created from the same firestore collection.
        this.name = name || this.collectionRef.id;

        this.query = query;

        this.firestore = firestore;
        this.realtimeMode = realtimeMode;
        this.fetchMode = fetchMode;
        this.deserialize = deserialize;
        this.serialize = serialize;
        this.defaultSetOptions = defaultSetOptions;

        const {
            logger,
        } = dependencies;

        this.logger = logger;

        if (this.fetchMode !== FetchMode.manual || this.realtimeMode === RealtimeMode.on) {
            this.disposables.push(
                reaction(() => this.query, () => {
                    this.log("Received new query");

                    // New query only needs to trigger fetch docs again if the collection is currently fetched
                    // The documents will be fetched later with the new query when manually / automatically fetching
                    // In case the initial query was already loading but not yet fetched, starting a new one will dispose the initial query
                    if (this.isFetched || this.isLoading) {
                        this.getDocs();
                    }
                })
            );

            if (this.fetchMode === FetchMode.auto) {
                this.disposables.push(onBecomeObserved(this.docsContainer, "docs", this.onObservedStatusChanged.bind(this, true)));
                this.disposables.push(onBecomeUnobserved(this.docsContainer, "docs", this.onObservedStatusChanged.bind(this, false)));

                this.disposables.push(onBecomeObserved(this, "isFetched", this.onObservedStatusChanged.bind(this, true)));
                this.disposables.push(onBecomeUnobserved(this, "isFetched", this.onObservedStatusChanged.bind(this, false)));
            }
        }

        this.log(`Created`);

        if (this.fetchMode === FetchMode.once) {
            this.getDocs();
        }
    }

    public get docs() {
        return Array.from(this.docsContainer.docs.values());
    }

    public get(id: string) {
        return this.docsContainer.docs.get(id);
    }

    public newId() {
        return doc(this.collectionRef).id;
    }

    // Todo: only expose fetchAsync if fetchMode = manual
    public fetchAsync() {
        if (this.fetchMode === FetchMode.manual) {
            return new Promise<void>(resolve => {
                this.getDocs();
                const disposeWhen = when(
                    () => this.isFetched,
                    () => {
                        disposeWhen();
                        resolve();
                    },
                );
            });
        } else {
            return Promise.reject(`You shouldn't try to manually fetch documents when fetchMode != manual. \n
            Set fetchMode to manual in the options when creation the Collection.`);
        }
    }

    private getDocs() {
        this.log(`Getting docs...`);

        // Flag collection as not fetched
        this.isFetched = false;

        // Unsubscribe from previous query updates
        this.cancelSnapshotListener();

        const query = this.filter(this.collectionRef);
        if (!query) {
            transaction(() => {
                this.isFetched = true;
                this.clear();
            });
            return;
        }

        let canClearCollection = true;

        this.isLoading = true;

        this.snapshotDisposable = onSnapshot(query, snapshot => {
            if (this.realtimeMode === RealtimeMode.off) {
                this.cancelSnapshotListener(false);
            }
            else {
                this.log(`Subscribed for updates`);
            }

            transaction(() => {
                this.isFetched = true;
                this.isLoading = false;

                if (canClearCollection) {
                    canClearCollection = false;
                    this.clear();
                }

                this.readSnapshot(snapshot);
            });
        });
    }

    private readSnapshot(snapshot: QuerySnapshot) {
        if (!snapshot.empty) {
            const docChanges = snapshot.docChanges();

            this.log(`Received ${docChanges.length} changes.`);

            docChanges.forEach(change => {
                const { doc: { id }, doc, type } = change;

                switch (type) {
                    case "added":
                    case "modified":
                        const firestoreData = doc.data() as K;
                        this.docsContainer.docs.set(id, new Doc(this.collectionRef,
                            firestoreData,
                            {
                                deserialize: this.deserialize,
                                watch: false
                            },
                            id)
                        );
                        break;
                    case "removed":
                        this.docsContainer.docs.delete(id);
                        break;
                }
            });
        } else {
            this.log(`Received empty snapshot in '${this.collectionRef.id}' collection.`);
            this.docsContainer.docs.clear();
        }
    }

    /**
     * Returns a collection query if query of collection has a value.
     * Returs the collectionRef from the argument if no query has been explicitly set.
     * Returns null if collection query is null. Aka, requesting collection with zero documents.
     */
    private filter(collectionRef: CollectionReference<K>) {
        if (this.query === null) return null;

        return this.query ? this.query(collectionRef) : collectionRef;
    }

    // TODO: when realtime updates is disabled, we must manually update the docs!
    // TODO: add update settings: Merge | Overwrite
    public updateAsync(data: Partial<T> | null, ...ids: string[]) {
        return this.getManyAsync(ids, { watch: false })
            .then(
                docs => Promise.all(
                    docs.map(
                        // GetManyAsync will return an array of Doc<T, K> with the results.
                        // Array can contain strings which represent the ids of missing documents.
                        oldData => typeof oldData !== "string"
                            ? updateDoc<K>(doc(this.collectionRef, oldData.id),
                                (this.serialize(
                                    data === null
                                        ? data
                                        : { ...oldData.data, ...data }
                                )) as any,
                            )
                            : Promise.resolve() // Trying to update something that doesn't exist
                    )
                )
            );
    }

    // TODO: when realtime updates is disabled, we must manually update the docs!
    public addAsync(data: T[]): Promise<string[]>;
    public addAsync(data: T, id?: string, setOptions?: SetOptions): Promise<string>;
    public addAsync(data: T | T[], id?: string, setOptions?: SetOptions): Promise<string | string[]> {
        const options = setOptions || this.defaultSetOptions
            ? { ...this.defaultSetOptions, ...setOptions }
            : undefined;

        if (data instanceof Array) {
            if (data.length === 0) {
                return Promise.resolve([]);
            }

            const insertedDocIds = [] as string[];
            const batch = writeBatch(this.firestore);
            data.forEach(docData => {
                const docRef = doc(this.collectionRef);
                batch.set(docRef, this.serialize(docData), { ...options });
                insertedDocIds.push(docRef.id);
            });

            return batch.commit()
                .then(() => insertedDocIds);
        } else {
            const firestoreData = this.serialize(data);
            return addAsync(this.collectionRef, firestoreData, id, options);
        }
    }

    public getAsync(id: string, options?: GetOptions) {
        const { watch = true } = options || {};
        return getAsync<K>(this.collectionRef, id)
            .then(doc => {
                const { deserialize } = this;
                return new Doc(this.collectionRef, doc, { deserialize, watch }, id);
            });
    }

    /**
     * Returns a promise that resolves with (Doc<T,K> | string)[]
     * If no document found for a given id that id will be returned in the result array
     * instead of Doc<T,K>.
     */
    // Todo: make sure utils/getAsync does not reject when doc not found by id
    // It should return null so we do not have to catch (and absorb true errors) here
    public getManyAsync(ids: string[], options?: GetOptions) {
        return Promise.all(ids.map(id => {
            return this.getAsync(id, options)
                .catch(() => {
                    this.log(`getManyAsync:id ${id} not found in collection ${this.collectionRef.id}.`);
                    return id;
                })
        }));
    }

    /**
     * Query the collection manually
     * @param constraints 
     * @returns 
     */
    public queryAsync(...constraints: QueryConstraint[]) {
        const q = firestoryQuery(this.collectionRef, ...constraints);

        return getDocs(q)
            .then((querySnapshot) => {
                const docs: T[] = [];

                querySnapshot.forEach((doc) => {
                    docs.push(this.deserialize(doc.data()));
                });

                return docs;
            });
    }

    // TODO: when realtime updates is disabled, we must manually update the docs!
    public deleteAsync(...ids: string[]) {
        if (ids.length > 1) {
            // remove multiple documents
            const batch = writeBatch(this.firestore);
            ids.forEach(id => {
                batch.delete(doc(this.collectionRef, id));
            })

            return batch.commit();

        } else {
            // single remove
            const id = ids[0];
            return deleteDoc(doc(this.collectionRef, id));
        }
    }

    public dispose() {
        this.cancelSnapshotListener();
        this.clear();

        this.disposables = this.disposables
            .reduce((p, c) => {
                c();
                return p;
            }, []);
    }

    private cancelSnapshotListener(shouldLog = true) {
        if (this.snapshotDisposable) {
            shouldLog && this.log(`Unsubscribing listener on docs...`);
            this.snapshotDisposable();
            this.snapshotDisposable = undefined;
        }
    }

    private clear() {
        if (this.docsContainer.docs.size) {
            this.log(`Docs cleared.`);
            this.docsContainer.docs.clear();
        }
    }

    private onObservedStatusChanged(isObserved: boolean) {
        this.numberOfObservers += isObserved ? 1 : -1;

        this.log(`Number of observers changed to: ${this.numberOfObservers}`);

        if (this.numberOfObservers === 1 && !this.isObserved) {
            this.isObserved = true;
            this.log(`Docs became observed.`);
            this.getDocs();
        } else if (this.numberOfObservers === 0) {
            this.isObserved = false;
            this.log(`Docs in collection became unobserved.`);
            this.cancelSnapshotListener();
        }
    }

    public get isActive() {
        return !!this.snapshotDisposable;
    }

    private log(message: string, severity: "info" | "warning" | "error" = "info") {
        this.logger && this.logger(`${this.name}: ${message}`, severity);
    }
}