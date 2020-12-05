import { Collection } from "../..";

import { initTestFirestore } from "../../../utils/test-firestore";

const {
    firestore,
} = initTestFirestore(
    "test-constructor-collection",
    ["books"],
);

describe("Collection.constructor", () => {
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