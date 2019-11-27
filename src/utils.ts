import { DocumentData, QueryDocumentSnapshot, DocumentSnapshot, CollectionReference, UpdateData } from "@firebase/firestore-types";

export function typeSnapshot<T extends DocumentData>(snapshot: QueryDocumentSnapshot): T & { id: string };
export function typeSnapshot<T extends DocumentData>(snapshot: DocumentSnapshot): (T & { id: string }) | undefined;
export function typeSnapshot<T extends DocumentData>(snapshot: DocumentSnapshot | QueryDocumentSnapshot): (T & { id: string }) | undefined {
    const docData = snapshot.data();
    if (docData === undefined) { return undefined; }
    else { return Object.assign({ id: snapshot.id }, docData as T); }
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

export const getAsync = <T>(collectionRef: CollectionReference, id: string) => {
    return new Promise<T & { id: string }>((resolve, reject) => {
        collectionRef.doc(id).get()
            .then((d: DocumentSnapshot) => d.data()
                ? resolve(typeSnapshot<T>(d))
                : reject()
            );
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