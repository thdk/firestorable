import { Collection } from "../../src";

import { initializeAdminApp } from "@firebase/testing";
const app = initializeAdminApp({ projectId: "test-constructor-collection" });
const db = app.firestore();

describe("Collection.constructor", () => {
    test("it should create a Collection instance with a string as collectionRef", () => {
        const collection = new Collection(db, "books");

        expect(collection).toBeInstanceOf(Collection);
    });

    test("it should create a Collection instance with a function as collectionRef", () => {
        const collection = new Collection(db, () => db.collection("books"));

        expect(collection).toBeInstanceOf(Collection);
    });

    test("it should create a Collection instance with a CollectionReference as collectionRef", () => {
        const collection = new Collection(db, db.collection("books"));

        expect(collection).toBeInstanceOf(Collection);
    });
});