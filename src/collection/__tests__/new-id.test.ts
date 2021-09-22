import { initializeTestEnvironment, RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { Collection, ICollectionOptions } from "../..";
import { logger } from "../../__test-utils__";

import type firebase from "firebase/compat";

describe("Collection.newId", () => {

    let testEnv: RulesTestEnvironment;
    let collectionRef: firebase.firestore.CollectionReference;
    let firestore: firebase.firestore.Firestore;

    beforeAll(async () => {
        testEnv = await initializeTestEnvironment({
            projectId: "test-new-id",
            firestore: {
                host: "localhost",
                port: 8080,
            }
        });

        firestore = testEnv.unauthenticatedContext().firestore();
        collectionRef = firestore.collection("books");
    });

    function createCollection<T, K = T>(options?: ICollectionOptions<T, K>) {
        return new Collection<T, K>(
            firestore,
            collectionRef,
            options,
            {
                logger,
            },
        );
    }


    it("should return a string", () => {
        const collection = createCollection();
        expect(typeof collection.newId()).toBe("string");
    });
});
