import type firebase from "firebase";

export const addAsync = <T>(
    collectionRef: firebase.firestore.CollectionReference,
    data: Partial<T>,
    id?: string,
    setOptions?: firebase.firestore.SetOptions,
) => {
    if (id || setOptions) {
        const docRef = id ? collectionRef.doc(id) : collectionRef.doc();
        return docRef
            .set(data, { ...setOptions })
            .then(() => docRef.id);
    }

    return collectionRef
        .add(data)
        .then(docRef => docRef.id);
};

/**
 * Returns a promise that resolves with T if document with id exists
 * or rejects if document with id does not exist.
 */
export function getAsync<T>(collectionRef: firebase.firestore.CollectionReference, id: string) {
    return collectionRef.doc(id)
        .get()
        .then(d => {
            if (!d.exists) {
                throw new Error(`Collection '${collectionRef.id}' contains no document with id '${id}'`);
            }

            return d.data() as T;
        });
};

export const addItemInBatch = (
    batch: firebase.firestore.WriteBatch,
    data: any,
    collectionRef: firebase.firestore.CollectionReference,
    id?: string,
) => {
    const doc = id === undefined ? collectionRef.doc() : collectionRef.doc(id);
    batch.set(doc, data);
};
