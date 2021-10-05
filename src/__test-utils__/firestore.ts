import {
    addDoc,
    doc,
    PartialWithFieldValue,
    setDoc,
    WithFieldValue,
    SetOptions,
    getDoc,
    CollectionReference,
    WriteBatch,
} from "firebase/firestore";

export function addAsync<T>(
    collectionRef: CollectionReference<T>,
    data: WithFieldValue<T> | PartialWithFieldValue<T>,
    id?: string,
    setOptions?: SetOptions,
) {
    if (id || setOptions) {
        const docRef = id ? doc(collectionRef, id) : doc(collectionRef);
        return setDoc(docRef, data, { ...setOptions })
            .then(() => docRef.id);
    }

    return addDoc(collectionRef, data as WithFieldValue<T>).then((ref) => ref.id);
};

/**
 * Returns a promise that resolves with T if document with id exists
 * or rejects if document with id does not exist.
 */
export function getAsync<T>(collectionRef: CollectionReference<T>, id: string) {
    return getDoc(doc(collectionRef, id))
        .then(d => {
            if (!d.exists()) {
                throw new Error(`Collection '${collectionRef.id}' contains no document with id '${id}'`);
            }

            return d.data() as T;
        });
};

export const addItemInBatch = (
    batch: WriteBatch,
    data: any,
    collectionRef: CollectionReference,
    id?: string,
) => {
    const docRef = id === undefined ? doc(collectionRef) : doc(collectionRef, id);
    batch.set(docRef, data);
};
