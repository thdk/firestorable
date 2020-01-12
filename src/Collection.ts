import * as firebase from 'firebase/app';
import 'firebase/firestore';

import { addAsync, getAsync } from './utils';
import {
    observable,
    reaction,
    transaction,
    onBecomeObserved,
    onBecomeUnobserved,
    computed,
    when,
} from 'mobx';

import { Doc } from "./Document";
import { QuerySnapshot } from '@firebase/firestore-types';

export type CollectionReference = firebase.firestore.CollectionReference;
export type Query = firebase.firestore.Query;

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
    query?: ((ref: CollectionReference) => Query) | null;
    deserialize?: (firestoreData: K) => T;
    serialize?: (appData: Partial<T> | null) => Partial<K>;
    name?: string;
}

export interface ICollectionDependencies {
    logger?: (log: string, severity: "info" | "warning" | "error") => void;
}

export interface ICollection<T, K = T> extends Collection<T, K> { }

export class Collection<T, K = T> {
    @observable
    private docsContainer = {
        docs: observable<string, Doc<T, K>>(new Map)
    };

    private isObserved = false;
    private name: string;

    @observable.ref
    public query?: ICollectionOptions<T, K>["query"];

    /** 'false' until documents are received for the current query */
    @observable
    public isFetched: boolean = false;

    /** 'true' whenever getDocs is fired and 'false' after receiving first snapshot. */
    @observable
    public isLoading: boolean = false;

    private numberOfObservers: number = 0;

    private readonly collectionRef: CollectionReference;
    private readonly realtimeMode: RealtimeMode;
    private readonly fetchMode: FetchMode;

    private snapshotDisposable?: () => void;
    private queryReactionDisposable?: () => void;
    private onBecomeObservedDisposable?: () => void;
    private onBecomeUnobservedDisposable?: () => void;

    private readonly deserialize: (firestoreData: K) => T;
    private readonly serialize: (appData: Partial<T> | null) => Partial<K>;
    private readonly firestore: firebase.firestore.Firestore;
    private readonly logger: ICollectionDependencies["logger"];

    constructor(
        firestore: firebase.firestore.Firestore,
        collection: (() => CollectionReference) | string | CollectionReference,
        options: ICollectionOptions<T, K> = {},
        dependencies: ICollectionDependencies = {},
    ) {
        const {
            realtimeMode = RealtimeMode.on,
            fetchMode = FetchMode.auto,
            query,
            deserialize = (x: K) => x as unknown as T,
            serialize = (x: Partial<T> | null) => x as unknown as Partial<K>,
            name,
        } = options;

        if (typeof collection === "string") {
            this.collectionRef = firestore.collection(collection);
        } else if (typeof collection === "function") {
            this.collectionRef = collection();
        } else {
            this.collectionRef = collection;
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

        const {
            logger,
        } = dependencies;

        this.logger = logger;

        if (this.fetchMode !== FetchMode.manual || this.realtimeMode === RealtimeMode.on) {
            this.queryReactionDisposable = reaction(() => this.query, () => {
                this.log("Received new query");

                // New query only needs to trigger fetch docs again if the collection is currently fetched
                // The documents will be fetched later with the new query when manually / automatically fetching
                if (this.isFetched) {
                    this.getDocs();
                }
            });

            if (this.fetchMode === FetchMode.auto) {
                this.onBecomeObservedDisposable = onBecomeObserved(this.docsContainer, "docs", this.onObservedStatusChanged.bind(this, true));
                this.onBecomeUnobservedDisposable = onBecomeUnobserved(this.docsContainer, "docs", this.onObservedStatusChanged.bind(this, false));

                this.onBecomeObservedDisposable = onBecomeObserved(this, "isFetched", this.onObservedStatusChanged.bind(this, true));
                this.onBecomeUnobservedDisposable = onBecomeUnobserved(this, "isFetched", this.onObservedStatusChanged.bind(this, false));
            }
        }

        this.log(`Created`);

        if (this.fetchMode === FetchMode.once) {
            this.getDocs();
        }
    }

    @computed
    public get docs() {
        return Array.from(this.docsContainer.docs.values());
    }

    public get(id: string) {
        return this.docsContainer.docs.get(id);
    }

    // Todo: only expose fetchAsync if fetchMode = manual
    public fetchAsync() {
        if (this.fetchMode === FetchMode.manual) {
            return new Promise(resolve => {
                this.getDocs();
                when(() => this.isFetched, resolve);
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

        this.snapshotDisposable = query
            .onSnapshot(snapshot => {
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

                this.log(`Type of change is '${type}'`);

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
    private filter(collectionRef: CollectionReference) {
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
                            ? this.collectionRef.doc(oldData.id)
                                .update(
                                    this.serialize(
                                        data === null
                                            ? data
                                            : { ...oldData.data, ...data }
                                    )
                                )
                            : Promise.resolve() // Trying to update something that doesn't exist
                    )
                )
            );
    }

    // TODO: when realtime updates is disabled, we must manually update the docs!
    public addAsync(data: T[]): Promise<string[]>;
    public addAsync(data: T, id?: string): Promise<string>;
    public addAsync(data: T | T[], id?: string): Promise<string | string[]> {
        if (data instanceof Array) {
            const insertedIds = [] as string[];
            const batch = this.firestore.batch();
            data.forEach(doc => {
                const docRef = this.collectionRef.doc();
                batch.set(docRef, this.serialize(doc));
                insertedIds.push(docRef.id);
            });

            return batch.commit()
                .then(() => insertedIds);
        } else {
            const firestoreData = this.serialize(data);
            return addAsync(this.collectionRef, firestoreData, id);
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

    // TODO: when realtime updates is disabled, we must manually update the docs!
    public deleteAsync(...ids: string[]) {
        if (ids.length > 1) {
            // remove multiple documents
            const batch = this.firestore.batch();
            ids.forEach(id => {
                batch.delete(this.collectionRef.doc(id));
            })

            return batch.commit();

        } else {
            // single remove
            const id = ids[0];
            return this.collectionRef.doc(id).delete();
        }
    }

    public dispose() {
        this.cancelSnapshotListener();
        this.clear();

        if (this.queryReactionDisposable) {
            this.queryReactionDisposable();
            this.queryReactionDisposable = undefined;
        }

        if (this.onBecomeObservedDisposable) {
            this.onBecomeObservedDisposable();
            this.onBecomeObservedDisposable = undefined;
        }

        if (this.onBecomeUnobservedDisposable) {
            this.onBecomeUnobservedDisposable();
            this.onBecomeUnobservedDisposable = undefined;
        }
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