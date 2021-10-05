import { initializeTestEnvironment, RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { Collection } from "../..";

import { FirebaseFirestore } from "@firebase/firestore-types";
import { collection } from "firebase/firestore";

const projectId = "test-constructor-collection";
describe("Collection.constructor", () => {
    let firestore: FirebaseFirestore;
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

    afterAll(() => testEnv.cleanup());
    test("it should create a Collection instance with a string as collectionRef", () => {
        const collection = new Collection(firestore, "books");

        expect(collection).toBeInstanceOf(Collection);
    });

    test("it should create a Collection instance with a function as collectionRef", () => {
        const booksCollection = new Collection(firestore, () => collection(firestore, "books"));

        expect(booksCollection).toBeInstanceOf(Collection);
    });

    test("it should create a Collection instance with a CollectionReference as collectionRef", () => {
        const booksCollection = new Collection(firestore, collection(firestore, "books"));

        expect(booksCollection).toBeInstanceOf(Collection);
    });
});