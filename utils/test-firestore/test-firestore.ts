import {
    initializeAdminApp,
    clearFirestoreData as clearFirestoreDataFn,
    initializeTestApp,
    loadFirestoreRules,
} from "@firebase/rules-unit-testing";

import fs from "fs";

import { app, firestore } from "firebase-admin";

type InitTestFirestoreResult = {
    refs: firestore.CollectionReference[];
    clearFirestoreData(): Promise<void>;
    deleteFirebaseApp(): void;
    app: app.App;
    firestore: firestore.Firestore;
}

type AuthUser = { uid: string, email: string };

const initAuthApp = async (
    projectId: string,
    collectionNames: string[],
    pathToRules: string,
    authUser: AuthUser,
): Promise<InitTestFirestoreResult> => {
    await loadFirestoreRules({
        projectId,
        rules: fs.readFileSync(pathToRules, "utf8")
    });

    const app = initializeTestApp({
        projectId,
        auth: authUser,
    });

    const firestore = app.firestore();

    return {
        refs: collectionNames.map(collectionName => firestore.collection(collectionName)),
        firestore,
        app,
        clearFirestoreData: () => clearFirestoreData(projectId),
        deleteFirebaseApp: () => app.delete(),
    } as any; // todo
}
export function initTestFirestore(projectId: string, collectionNames: string[]): any // InitTestFirestoreResult;
export function initTestFirestore(
    projectId: string,
    collectionNames: string[],
    auth: { uid: string, email: string },
    pathToRules: string,
): Promise<InitTestFirestoreResult>
export function initTestFirestore(
    projectId: string,
    collectionNames: string[],
    auth?: { uid: string, email: string },
    pathToRules?: string,
): InitTestFirestoreResult | Promise<InitTestFirestoreResult> {

    if (pathToRules && auth) {
        return initAuthApp(projectId, collectionNames, pathToRules, auth);
    }

    const app = initializeAdminApp({
        projectId,
    });

    const firestore = app.firestore();

    return {
        refs: collectionNames.map(collectionName => firestore.collection(collectionName)),
        firestore,
        app,
        clearFirestoreData: () => clearFirestoreData(projectId),
        deleteFirebaseApp: () => app.delete(),
    };
};

export const clearFirestoreData = (projectId: string) => {
    return clearFirestoreDataFn({ projectId });
};
