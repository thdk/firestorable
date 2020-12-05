import {
    initializeAdminApp,
    clearFirestoreData as clearFirestoreDataFn,
    initializeTestApp,
    loadFirestoreRules,
} from "@firebase/rules-unit-testing";

import fs from "fs";
import path from "path";

import type firebase from "firebase";

type InitTestFirestoreResult = {
    refs: firebase.firestore.CollectionReference[];
    clearFirestoreData(): Promise<void>;
    deleteFirebaseApp(): void;
    app: firebase.app.App;
    firestore: firebase.firestore.Firestore;
}

type AuthUser = { uid: string, email: string };

const initAuthApp = async (
    projectId: string,
    collectionNames: string[],
    pathToRules: string,
    authUser: AuthUser,
) => {
    await loadFirestoreRules({
        projectId,
        rules: fs.readFileSync(path.resolve(__dirname, pathToRules), "utf8")
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
    };
}
export function initTestFirestore(projectId: string, collectionNames: string[]): InitTestFirestoreResult;
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
