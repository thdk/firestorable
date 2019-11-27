import * as firebase from 'firebase/app';
import 'firebase/firestore';

import { updateAsync, addAsync, getAsync } from './utils';
import { observable, ObservableMap, reaction, transaction } from 'mobx';
import { Doc } from "./Document";

export type CollectionReference = firebase.firestore.CollectionReference;
export type Query = firebase.firestore.Query;

export interface IDisposable {
    dispose: () => void;
}

export interface ICollection<T, K = T> extends IDisposable {
    readonly docs: ObservableMap<string, Doc<T, K>>;
    query?: (ref: CollectionReference) => Query;
    getDocs: () => void;
    updateAsync: (data: Partial<T> | "delete", ...ids: string[]) => Promise<void>;
    addAsync: (data: T | T[], id?: string) => Promise<string | void>;
    getAsync: (id: string, watch?: boolean) => Promise<Doc<T, K & { id: string }>>;
    deleteAsync: (...ids: string[]) => Promise<void>;
    unsubscribeAndClear: () => void;
}

export interface ICollectionOptions<T, K> {
    realtime?: boolean;
    query?: (ref: CollectionReference) => Query;
    deserialize?: (firestoreData: K) => T;
    serialize?: (appData: Partial<T> | "delete") => Partial<K>;
}

export class Collection<T, K = T> implements ICollection<T, K> {
    public docs: ObservableMap<string, Doc<T, K>> = observable(new Map);

    @observable
    public query?: (ref: CollectionReference) => Query;

    private readonly collectionRef: CollectionReference;
    private readonly isRealtime: boolean;
    private unsubscribeFirestore?: () => void;
    private readonly queryReactionDisposable: () => void;
    private readonly deserialize: (firestoreData: K) => T;
    private readonly serialize: (appData: Partial<T> | "delete") => Partial<K>;
    private readonly firestore: firebase.firestore.Firestore;

    private canClearCollection = true;

    constructor(firestore: firebase.firestore.Firestore, getFirestoreCollection: () => CollectionReference, options: ICollectionOptions<T, K> = {}) {
        const {
            realtime = false,
            query,
            deserialize = (x: K) => x as unknown as T,
            serialize = (x: Partial<T> | "delete") => x as unknown as Partial<K>
        } = options;

        this.firestore = firestore;
        this.isRealtime = realtime;
        this.deserialize = deserialize;
        this.serialize = serialize;

        this.collectionRef = getFirestoreCollection();

        this.queryReactionDisposable = reaction(() => this.query, this.getDocs.bind(this));
        // setting a query immediately in the constructor will also trigger the above reaction
        // => no need to manually call getDocs when a query is provided in the constructor of the collection
        if (query) {
            this.query = query;
        }
    }

    public getDocs() {
        this.canClearCollection = true;
        if (this.unsubscribeFirestore) this.unsubscribeFirestore();

        this.unsubscribeFirestore =
            this.filter(this.collectionRef)
                .onSnapshot(snapshot => {
                    if (!this.isRealtime) this.unsubscribeFirestore!();

                    transaction(() => {
                        if (this.canClearCollection) {
                            this.canClearCollection = false;
                            if (this.docs.size) {
                                this.docs.clear();
                            }
                        }

                        if (!snapshot.empty) {

                            snapshot.docChanges().forEach(change => {
                                const { doc: { id }, doc } = change;
                                if (change.type === "added" || change.type === "modified") {
                                    const firestoreData = doc.data() as K;
                                    this.docs.set(id, new Doc<T, K>(this.collectionRef,
                                        firestoreData,
                                        {
                                            deserialize: this.deserialize,
                                            watch: false
                                        },
                                        id)
                                    );
                                }
                                else if (change.type === "removed") {
                                    this.docs.delete(id);
                                }
                            });
                        }
                    })

                });
    }

    private filter(collectionRef: CollectionReference) {
        return this.query ? this.query(collectionRef) : collectionRef;
    }

    // TODO: when realtime updates is disabled, we must manually update the docs!
    // TODO: add update settings: Merge | Overwrite
    public updateAsync(data: Partial<T> | "delete", ...ids: string[]) {
        if (ids.length) {
            return this.getManyAsync(ids, false)
                .then(docs => Promise.all(
                    docs.map(
                        oldData => typeof oldData !== "string"
                            ? updateAsync(
                                this.collectionRef, Object.assign(
                                    this.serialize(data === "delete"
                                        ? data
                                        : { ...oldData.data, ...data }
                                    ),
                                    { id: oldData.id }
                                )
                            )
                            // trying to update something that doesn't exist => add it instead
                            : addAsync(this.collectionRef, this.serialize(data), oldData)
                                .then(() => { }) // convert Promise<string> into Promise<void> :(
                    )
                )
                    .then(() => { })
                );
        }
        else {
            return addAsync(this.collectionRef, this.serialize(data))
                .then(() => { })
        }
    }

    // TODO: when realtime updates is disabled, we must manually update the docs!
    public addAsync(data: T | T[], id?: string) {
        if (data instanceof Array) {
            const batch = this.firestore.batch();
            data.forEach(doc => {
                batch.set(this.collectionRef.doc(), this.serialize(doc));
            })

            return batch.commit();
        } else {
            const firestoreData = data ? this.serialize(data) : {};
            return addAsync(this.collectionRef, firestoreData, id);
        }

    }

    // TODO: If realtime is enabled, we can safely fetch from the docs instead of a new get request
    public getAsync(id: string, watch = true) {
        return getAsync<K>(this.collectionRef, id).then(doc => {
            const { deserialize } = this;
            return new Doc<T, K & { id: string }>(this.collectionRef, doc, { deserialize, watch }, id);
        });
    }

    /**
     * Returns a promise that resolves with an array of firestore documents
     * If no document found for a given id that id will be returned in the result array
     * instead of a document.
     */
    // Todo: make sure utils/getAsync does not reject when doc not found by id
    // It should return null so we do not have to catch (and absorb true errors) here
    public getManyAsync(ids: string[], watch = true) {
        return Promise.all(ids.map(id => {
            return this.getAsync(id, watch)
                .catch(() => id)
        }));
    }

    // TODO: when realtime updates is disabled, we must manually update the docs!
    // WARNING: NEEDS INVESTIGATION: No snapshot change received when deleting a registration
    // Temporary always manually remove the registration from the docs.
    // update: first findings are that when a query is set, there won't be delete snapshot changes
    // so when we have an active query => always manually update the docs
    public deleteAsync(...ids: string[]) {
        if (ids.length > 1) {
            // remove multiple documents
            const batch = this.firestore.batch();
            ids.forEach(id => {
                batch.delete(this.collectionRef.doc(id));
            })

            return batch.commit().then(() => {
                ids.forEach(id => this.docs.delete(id));
            });

        } else {
            // single remove
            const id = ids[0];
            return this.collectionRef.doc(id).delete().then(() => {
                this.query && this.docs.delete(id);
            }, () => {
                throw new Error("Could not delete document");
            });
        }
    }

    public dispose() {
        this.unsubscribeAndClear();
        this.queryReactionDisposable();
    }

    public unsubscribeAndClear() {
        if (this.unsubscribeFirestore) this.unsubscribeFirestore();
        this.unsubscribeFirestore = undefined;
        this.docs.clear();
    }
}