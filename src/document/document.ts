import type firebase from "firebase";

import { observable, computed, action, IObservableValue, makeObservable } from "mobx";

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

    private ref: firebase.firestore.DocumentReference;
    public readonly id: string;
    private deserialize: IDocOptions<T, K>["deserialize"];
    private unwatchDocument?: () => void;

    constructor(collectionRef: firebase.firestore.CollectionReference, data: K | null, options: IDocOptions<T, K>, id?: string) {
        makeObservable<Doc<T,K>, "setData">(this, {
            setData: action,
            data: computed
        });

        const { deserialize, watch } = options;
        this.deserialize = deserialize;
        this.ref = id ? collectionRef.doc(id) : collectionRef.doc();
        this.id = this.ref.id;
        this.setData(data ? deserialize(data) : undefined);

        if (watch) { this.watch(); }
    }

    private setData(data: T | undefined) {
        this.dataField.set(data);
    }

    public get data(): T | undefined {
        return this.dataField.get();
    }

    public watch() {
        this.unwatchDocument = this.ref.onSnapshot(snapshot => {
            // snapshot data can be undefined when document get's deleted
            const data = snapshot.data();
            this.dataField.set(data ? this.deserialize(data as unknown as K) : undefined);
        });
    }

    public unwatch() {
        this.unwatchDocument && this.unwatchDocument();
    }
}