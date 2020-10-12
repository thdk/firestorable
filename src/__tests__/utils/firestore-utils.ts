import * as firebase from '@firebase/rules-unit-testing';
import { initializeAdminApp } from "@firebase/rules-unit-testing";

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
        clearFirestoreDataAsync: () => clearFirestoreDataAsync(projectId),
    };
};

export const clearFirestoreDataAsync = (projectId: string) => {
    return firebase.clearFirestoreData({ projectId });
};

export const deleteFirebaseAppsAsync = () => {
    return Promise.all(firebase.apps().map(app => app.delete()));
};