import { CollectionReference, DocumentReference } from "@firebase/firestore-types";

import { observable, computed, action } from "mobx";
import { Undefined, UndefinedValue, isUndefinedValue } from "mobx-undefined-value";

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
    @observable
    private dataField: T | Undefined = UndefinedValue;

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
        this.setData(data ? deserialize(data) : null);

        if (watch) { this.watch(); }
    }

    @action
    private setData(data: T | null) {
        this.dataField = data || UndefinedValue;
    }

    @computed
    public get data(): T | undefined {
        return isUndefinedValue(this.dataField) ? undefined : this.dataField;
    }

    public watch() {
        this.unwatchDocument = this.ref.onSnapshot(snapshot => {
            this.dataField = this.deserialize(snapshot.data() as unknown as K);
        });
    }

    public unwatch() {
        this.unwatchDocument && this.unwatchDocument();
    }
}