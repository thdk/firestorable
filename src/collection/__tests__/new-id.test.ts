import { initializeTestEnvironment, RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { Collection, ICollectionOptions } from "../..";
import { logger } from "../../__test-utils__";

import { collection, CollectionReference } from "firebase/firestore";

describe("Collection.newId", () => {

    let testEnv: RulesTestEnvironment;
    let collectionRef: CollectionReference<any>;
    let firestore: any;

    beforeAll(async () => {
        testEnv = await initializeTestEnvironment({
            projectId: "test-new-id",
            firestore: {
                host: "localhost",
                port: 8080,
            }
        });

        firestore = testEnv.unauthenticatedContext().firestore();
        collectionRef = collection(firestore, "books");
    });

    afterAll(() => testEnv.cleanup());

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
