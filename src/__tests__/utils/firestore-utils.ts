import * as firebase from '@firebase/testing';
import { WriteBatch, CollectionReference } from "@firebase/firestore-types";
import { initializeAdminApp } from "@firebase/testing";

export const addItemInBatch = (batch: WriteBatch, data: any, collectionRef: CollectionReference, id?: string) => {
    const doc = id === undefined ? collectionRef.doc() : collectionRef.doc(id);
    batch.set(doc, data);
};

export const initDatabase = (projectId: string, collectionName: string) => {
    const app = initializeAdminApp({ projectId });
    const db = app.firestore();
    return { collectionRef: db.collection(collectionName), db };
};

export const clearFirestoreDataAsync = (projectId: string) => {
    return firebase.clearFirestoreData({ projectId });
};

export const deleteFirebaseAppsAsync = () => {
    return Promise.all(firebase.apps().map(app => app.delete()));
};