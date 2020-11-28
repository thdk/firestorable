import { 
    initializeAdminApp, 
    clearFirestoreData as clearFirestoreDataFn,
    apps,
} from "@firebase/rules-unit-testing";

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

export const initDatabase = (projectId: string, collectionName: string) => {
    const app = initializeAdminApp({ projectId });
    const db = app.firestore();
    return {
        collectionRef: db.collection(collectionName),
        db,
        clearFirestoreDataAsync: () => clearFirestoreData(projectId),
    };
};

export const clearFirestoreData = (projectId: string) => {
    return clearFirestoreDataFn({ projectId });
};

export const deleteFirebaseApps = () => {
    return Promise.all(apps().map(app => app.delete()));
};