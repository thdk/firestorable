import { Collection, ICollectionOptions } from "../..";
import { logger } from "../../__test-utils__";
import { when, autorun } from "mobx";


import { initializeTestEnvironment, RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, CollectionReference } from "firebase/firestore";
const projectId = "test-query";

import { FirebaseFirestore } from "@firebase/firestore-types";

describe("Collection.query", () => {
    let firestore: FirebaseFirestore;
    let testEnv: RulesTestEnvironment;
    let collectionRef: CollectionReference<any>;
    let booksCollection: Collection<{ value: string }>;

    function createCollection<T, K = T>(options?: ICollectionOptions<T, K>) {
        return new Collection<T, K>(
            firestore,
            collectionRef,
            options,
            {
                logger: logger
            }
        );
    }

    beforeAll(async () => {
        testEnv = await initializeTestEnvironment({
            projectId,
            firestore: {
                host: "localhost",
                port: 8080,
            }
        });

        firestore = testEnv.unauthenticatedContext().firestore();
        collectionRef = collection(firestore, "books");
    });


    afterAll(() => testEnv.cleanup());

    beforeEach(async () => {
        await testEnv.clearFirestore()
        booksCollection = createCollection();

        return booksCollection.addAsync({ value: "A" });
    });

    afterEach(() => booksCollection.dispose());

    test("it should clear the documents when set to null", () => {
        // Add a dummy observer to documents will get fetched
        autorun(() => {
            jest.fn()(booksCollection.docs);
        });

        return when(() => booksCollection.isFetched)
            .then(() => {
                expect(booksCollection.docs.length).toBe(1);

                booksCollection.query = null;

                return when(() => booksCollection.isFetched)
                    .then(() => {
                        expect(booksCollection.docs.length).toBe(0);
                    });
            });
    });

    test("it should clear the documents when set to null even if collection is not being observed anymore", () => {
        // Add a dummy observer to documents will get fetched
        const unobserve = autorun(() => {
            jest.fn()(booksCollection.docs);
        });

        return when(() => booksCollection.isFetched)
            .then(() => {
                expect(booksCollection.docs.length).toBe(1);

                unobserve();

                booksCollection.query = null;

                expect(booksCollection.docs.length).toBe(0);
            });
    });
});