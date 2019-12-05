import { DocumentData, QueryDocumentSnapshot, DocumentSnapshot, CollectionReference, UpdateData } from "@firebase/firestore-types";

export function typeSnapshot<T extends DocumentData>(snapshot: QueryDocumentSnapshot, includeId: true): T & { id: string };
export function typeSnapshot<T extends DocumentData>(snapshot: QueryDocumentSnapshot, includeId: false): T
export function typeSnapshot<T extends DocumentData>(snapshot: QueryDocumentSnapshot, includeId: boolean): T & { id?: string };
export function typeSnapshot<T extends DocumentData>(snapshot: DocumentSnapshot, includeId: true): (T & { id: string }) | undefined;
export function typeSnapshot<T extends DocumentData>(snapshot: DocumentSnapshot, includeId: false): T | undefined;
export function typeSnapshot<T extends DocumentData>(snapshot: DocumentSnapshot, includeId: boolean): T | undefined;
export function typeSnapshot<T extends DocumentData>(snapshot: DocumentSnapshot | QueryDocumentSnapshot, includeId: boolean): (T & { id?: string }) | undefined {
    const docData = snapshot.data();
    if (docData === undefined) { return undefined; }
    else {
        if (includeId) {
            return Object.assign({ id: snapshot.id }, docData as T);
        }
        else {
            return docData as T;
        }
    }
}

export const updateAsync = <T extends UpdateData>(collectionRef: CollectionReference, data: Partial<T> & Pick<T, "id">) => {
    return collectionRef
        .doc(data.id)
        .update(data);
};

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

export const getManyAsync = <T>(collectionRef: CollectionReference, ...ids: string[]) => {
    return Promise.all(
        ids.map(id =>
            getAsync<T>(collectionRef, id)
                .catch(() => id)
        )
    );
};