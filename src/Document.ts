import { CollectionReference, DocumentReference } from "@firebase/firestore-types";

import { observable, computed, action, IObservableValue } from "mobx";

export interface IDocOptions<T, K> {
    deserialize: (firestoreData: K) => T;
    watch?: boolean;
}

export interface IDoc<T> {
    readonly id: string;
    readonly data: T | undefined;
    watch(): void;
    unwatch(): void;
}

export class Doc<T, K = T> implements IDoc<T> {

    private dataField: IObservableValue<T | undefined> = observable.box(undefined);

    private ref: DocumentReference;
    public readonly id: string;
    private deserialize: IDocOptions<T, K>["deserialize"];
    private unwatchDocument?: () => void;

    // TODO: don't allow null as a type for data
    constructor(collectionRef: CollectionReference, data: K | null, options: IDocOptions<T, K>, id?: string) {
        const { deserialize, watch } = options;
        this.deserialize = deserialize;
        this.ref = id ? collectionRef.doc(id) : collectionRef.doc();
        this.id = this.ref.id;
        this.setData(data ? deserialize(data) : undefined);

        if (watch) { this.watch(); }
    }

    @action
    private setData(data: T | undefined) {
        this.dataField.set(data);
    }

    @computed
    public get data(): T | undefined {
        return this.dataField.get();
    }

    public watch() {
        this.unwatchDocument = this.ref.onSnapshot(snapshot => {
            this.dataField.set(this.deserialize(snapshot.data() as unknown as K));
        });
    }

    public unwatch() {
        this.unwatchDocument && this.unwatchDocument();
    }
}