import { initializeTestEnvironment, RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { Collection, ICollectionOptions, RealtimeMode } from "../..";
import { logger } from "../../__test-utils__";

import type firebase from "firebase/compat";

const projectId = "test-delete-documents";
describe("Collection.deleteAsync", () => {
    let collectionRef: firebase.firestore.CollectionReference;
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
        collectionRef = firestore.collection("books");
    });


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

    afterAll(() => testEnv.cleanup());

    beforeEach(async () => {
        await testEnv.clearFirestore()
        // Add initial data
        return Promise.all([
            collectionRef.doc("id1").set({ total: 1, name: "A" }),
            collectionRef.doc("id2").set({ total: 2, name: "B" }),
            collectionRef.doc("id3").set({ total: 3, name: "C" }),
            collectionRef.doc("id4").set({ total: 2, name: "C" }),
        ]);
    });

    describe("when collection is not filtered with a query", () => {
        it("should delete the document with the given id", () => {
            const collection = createCollection({ realtimeMode: RealtimeMode.off });

            return collection.deleteAsync("id2")
                .then(() => {
                    return collectionRef.doc("id2").get()
                        .then(doc => {
                            expect(doc.exists).toBe(false);
                        });
                });
        });

        it("should delete multiple documents", () => {
            const collection = createCollection();

            return collection.deleteAsync("id2", "id3")
                .then(() => {
                    return Promise.all([
                        collectionRef.doc("id2").get(),
                        collectionRef.doc("id3").get(),
                    ])
                        .then(([snapshot1, snapshot2]) => {
                            expect(snapshot1.exists).toBe(false);
                            expect(snapshot2.exists).toBe(false);
                        });
                });
        });
    });
});
