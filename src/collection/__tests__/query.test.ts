import { Collection, ICollectionOptions } from "../..";
import { logger } from "../../__test-utils__";
import { when, autorun } from "mobx";


import type firebase from "firebase/compat"
import { initializeTestEnvironment, RulesTestEnvironment } from "@firebase/rules-unit-testing";
const projectId = "test-query";



describe("Collection.query", () => {
    let firestore: firebase.firestore.Firestore;
    let testEnv: RulesTestEnvironment;
    let collectionRef: firebase.firestore.CollectionReference;
    let collection: Collection<{ value: string }>;

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
        collectionRef = firestore.collection("books");
    });

    
    afterAll(() => testEnv.cleanup());
    
    beforeEach(async () => {
        await testEnv.clearFirestore()
        collection = createCollection();
        
        return collection.addAsync({ value: "A" });
    });

    afterEach(() => collection.dispose());

    test("it should clear the documents when set to null", () => {
        // Add a dummy observer to documents will get fetched
        autorun(() => {
            jest.fn()(collection.docs);
        });

        return when(() => collection.isFetched)
            .then(() => {
                expect(collection.docs.length).toBe(1);

                collection.query = null;

                return when(() => collection.isFetched)
                    .then(() => {
                        expect(collection.docs.length).toBe(0);
                    });
            });
    });

    test("it should clear the documents when set to null even if collection is not being observed anymore", () => {
        // Add a dummy observer to documents will get fetched
        const unobserve = autorun(() => {
            jest.fn()(collection.docs);
        });

        return when(() => collection.isFetched)
            .then(() => {
                expect(collection.docs.length).toBe(1);

                unobserve();

                collection.query = null;

                expect(collection.docs.length).toBe(0);
            });
    });
});