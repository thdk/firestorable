import { CollectionReference } from "@firebase/firestore-types";

export const addAsync = <T>(collectionRef: CollectionReference, data: Partial<T>, id?: string) => {
    const docRef = id ? collectionRef.doc(id) : collectionRef.doc();
    return docRef.set(data).then(() => docRef.id);
};

/**
 * Returns a promise that resolves with T if document with id exists
 * or rejects if document with id does not exist.
 */
export function getAsync<T>(collectionRef: CollectionReference, id: string) {
    return collectionRef.doc(id)
        .get()
        .then(d => {
            if (!d.exists) {
                throw new Error(`Collection '${collectionRef.id}' contains no document with id '${id}'`);
            }

            return d.data() as T;
        });
};
