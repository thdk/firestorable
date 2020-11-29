import type firebase from "firebase";

export const addItemInBatch = (
    batch: firebase.firestore.WriteBatch,
    data: any,
    collectionRef: firebase.firestore.CollectionReference,
    id?: string,
) => {
    const doc = id === undefined ? collectionRef.doc() : collectionRef.doc(id);
    batch.set(doc, data);
};
