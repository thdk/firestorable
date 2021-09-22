import type firebase from "firebase";

import { observable, action, transaction, computed, reaction, makeObservable } from "mobx";

import { Collection, ICollectionDependencies, ICollectionOptions } from "../../collection";
import { Doc } from "../../document";

export interface StoreOptions<T = any, K = T> {
    collection: string,
    collectionDependencies?: ICollectionDependencies,
    collectionOptions?: ICollectionOptions<T, K>,
    createNewDocumentDefaults?(overrideDefaultsWith?: Partial<T>): Partial<T> | Promise<Partial<T>>,
};

export class CrudStore<T = any, K = T> {
    private activeDocumentIdField: string | undefined = undefined;

    private activeDocumentField: Doc<T, K> | undefined = undefined;

    public readonly collection: Collection<T, K>;

    private newDocumentField = observable.box<Partial<T> | undefined>();
    private createNewDocumentDefaults?(): Partial<T> | Promise<Partial<T>>;

    private disposeFns: (() => void)[];

    constructor(
        {
            collection,
            collectionDependencies,
            collectionOptions,
            createNewDocumentDefaults,
        }: StoreOptions<T, K>,
        {
            firestore
        }: {
            firestore: firebase.firestore.Firestore,
        }
    ) {
        makeObservable<CrudStore, "activeDocumentIdField" | "activeDocumentField">(this, {
            activeDocumentIdField: observable.ref,
            activeDocumentField: observable.ref,
            setActiveDocumentId: action,
            createNewDocument: action,
            activeDocument: computed,
            activeDocumentId: computed
        });

        this.createNewDocumentDefaults = createNewDocumentDefaults;

        this.collection = new Collection<T, K>(
            firestore,
            collection,
            collectionOptions,
            collectionDependencies,
        );

        this.disposeFns = [
            reaction(
                () => this.activeDocumentIdField,
                (id) => {
                    if (!id) {
                        transaction(() => {
                            if (this.activeDocumentField) {
                                this.activeDocumentField.unwatch();
                            }
                            this.newDocumentField.set(undefined);
                            this.activeDocumentField = undefined;
                        });

                    } else {
                        this.activeDocumentField = this.collection.get(id);
                        if (this.activeDocumentField) {
                            this.activeDocumentField.watch();
                        } else {
                            // fetch the registration manually
                            this.collection.getAsync(id)
                                .then(regDoc => {
                                    this.activeDocumentField = regDoc;
                                    this.activeDocumentField.watch();
                                })
                                .catch(() => {
                                    this.activeDocumentIdField = undefined;
                                });
                        }
                    }
                },
            ),
        ];
    }

    public deleteDocument(id: string, deleteOptions: {
        useFlag?: boolean,
    } = {}) {
        return this.deleteDocuments(deleteOptions, id);
    }

    public deleteDocuments(
        {
            useFlag = false,
        }: {
            useFlag?: boolean,
        } = {},
        ...ids: string[]
    ) {
        if (!ids.length) {
            return Promise.resolve();
        }

        const promise: Promise<void | void[]> = useFlag
            ? this.collection.updateAsync(null, ...ids)
            : this.collection.deleteAsync(...ids);

        return promise.catch(e => {
            console.error(e);
            return [];
        });
    }

    public addDocument(document: T, id?: string) {
        return this.collection.addAsync(document, id);
    }

    public addDocuments(documents: T[]) {
        return this.collection.addAsync(documents);
    }

    public updateDocument(document: Partial<T>, id: string) {
        return this.collection.updateAsync(document, id);
    }

    public setActiveDocumentId(id?: string) {
        this.activeDocumentIdField = id;
    }

    public async createNewDocument(document?: Partial<T>) {
        const defaultData: Partial<T> = this.createNewDocumentDefaults
            ? await this.createNewDocumentDefaults()
            : {};

        const newDocument = { ...defaultData, ...document };
        transaction(() => {
            this.newDocumentField.set(newDocument);
            this.activeDocumentIdField = undefined;
        });

        return newDocument;
    }

    public get activeDocument() {
        if (this.activeDocumentField) { 
            return this.activeDocumentField.data;
        }
        return this.newDocumentField.get();
    }

    public get activeDocumentId() {
        return this.activeDocumentIdField;
    }

    public updateActiveDocument(document: Partial<T>) {
        if (this.activeDocumentId) {
            this.updateDocument(
                document,
                this.activeDocumentId,
            );
        } else {
            throw new Error("Can't update active document. No active document set.");
        }
    }

    public dispose() {
        this.disposeFns.reverse().forEach(fn => fn());
        if (this.activeDocumentField){
            this.activeDocumentField.unwatch();
        }
        this.activeDocumentField = undefined;
        this.activeDocumentIdField = undefined;
        this.newDocumentField.set(undefined);
    }
}