import { initializeTestEnvironment, RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { Collection } from "../..";

import type firebase from "firebase/compat";


const projectId = "test-constructor-collection";
describe("Collection.constructor", () => {
    let firestore: firebase.firestore.Firestore;
    let testEnv: RulesTestEnvironment;

    beforeAll(async () => {
        testEnv = await initializeTestEnvironment({
            projectId,
            firestore: {
                host: "localhost",
                port: 8080,
            }
        });

        firestore = testEnv.unauthenticatedContext().firestore();
    });

    test("it should create a Collection instance with a string as collectionRef", () => {
        const collection = new Collection(firestore, "books");

        expect(collection).toBeInstanceOf(Collection);
    });

    test("it should create a Collection instance with a function as collectionRef", () => {
        const collection = new Collection(firestore, () => firestore.collection("books"));

        expect(collection).toBeInstanceOf(Collection);
    });

    test("it should create a Collection instance with a CollectionReference as collectionRef", () => {
        const collection = new Collection(firestore, firestore.collection("books"));

        expect(collection).toBeInstanceOf(Collection);
    });
});