import { initializeTestEnvironment, RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { Collection, ICollectionOptions, FetchMode, RealtimeMode } from "../..";
import { logger, addItemInBatch } from "../../__test-utils__";

import type firebase from "firebase/compat";

describe("realtime mode", () => {
    let collection: Collection<{ value: string }>;
    let testEnv: RulesTestEnvironment;
    let collectionRef: firebase.firestore.CollectionReference;
    let firestore: firebase.firestore.Firestore;

    beforeAll(async () => {
        testEnv = await initializeTestEnvironment({
            projectId: "test-real-time-mode",
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
                logger
            }
        );
    }

    beforeEach(() => testEnv.clearFirestore());

    afterAll(() => testEnv.cleanup());


    describe("With realtime mode = on:", () => {


        beforeEach(() => {
            collection = createCollection({ fetchMode: FetchMode.manual });

            // Add initial data
            const batch = firestore.batch();
            addItemInBatch(batch, { value: "A" }, collectionRef, "id1");
            return batch.commit().then(() => collection.fetchAsync());
        });

        afterEach(() => collection.dispose());

        describe("when documents are changed while watching the collection", () => {
            test('it should update documents in local docs', () => {

                return collectionRef.doc("id1").set({
                    value: "B"
                }).then(() => {
                    const doc = collection.get("id1");
                    expect(doc).toBeDefined();

                    expect(doc!.data!.value).toBe("B");
                });
            });
        });

        describe("when documents are deleted while watching the collection", () => {
            describe("when the collection is not filtered", () => {
                test('it should delete document in local docs', () => {
                    // Add one more document so we are not removing the last one (see next test)
                    return collectionRef.add({ value: "foo" }).then(() => {
                        // Verify document to be deleted exists
                        const doc = collection.get("id1");
                        expect(doc).toBeDefined();

                        return collectionRef.doc("id1").delete()
                            .then(() => {
                                // Verify if document has been deleted in local dictionary
                                const doc = collection.get("id1");
                                expect(doc).toBeUndefined();
                            });
                    });
                });

                /** When deleting last document of collection, an emtpy snapshot is received instead of a snapshot with type = deleted */
                test('it should delete document in local docs even if its the last one', () => {
                    // Verify document to be deleted exists
                    const doc = collection.get("id1");
                    expect(doc).toBeDefined();

                    return collectionRef.doc("id1").delete()
                        .then(() => {
                            // Verify if document has been deleted in local dictionary
                            const doc = collection.get("id1");
                            expect(doc).toBeUndefined();
                        });
                });
            });

            describe("when the collection is filtered", () => {
                beforeEach(() => {
                    collection.dispose();

                    collection = createCollection({
                        fetchMode: FetchMode.manual,
                        query: ref => ref.where("value", "==", "A"),
                    });

                    return collection.fetchAsync();
                });

                test('it should delete document in local docs', () => {
                    // Add one more document so we are not removing the last one (see next test)
                    return collectionRef.add({ value: "A" }).then(() => {
                        // Verify document to be deleted exists
                        const doc = collection.get("id1");
                        expect(doc).toBeDefined();

                        return collectionRef.doc("id1").delete()
                            .then(() => {
                                // Verify if document has been deleted in local dictionary
                                const doc = collection.get("id1");
                                expect(doc).toBeUndefined();
                            });
                    });
                });

                /** When deleting last document of collection, an emtpy snapshot is received instead of a snapshot with type = deleted */
                test('it should delete document in local docs even if its the last one', () => {
                    // Verify document to be deleted exists
                    const doc = collection.get("id1");
                    expect(doc).toBeDefined();

                    return collectionRef.doc("id1").delete()
                        .then(() => {
                            // Verify if document has been deleted in local dictionary
                            const doc = collection.get("id1");
                            expect(doc).toBeUndefined();
                        });
                });
            });

        });

        describe("when documents are added while watching the collection", () => {
            test('it should add documents in local docs', () => {
                return collectionRef.doc("id3").set({ value: "C" })
                    .then(() => {
                        // Verify if document has been added to local dictionary
                        const doc = collection.get("id3");
                        expect(doc).toBeDefined();
                    });
            });
        });
    });

    describe("With realtime mode = off:", () => {
        beforeEach(() => {
            collection = createCollection({ realtimeMode: RealtimeMode.off, fetchMode: FetchMode.manual });

            // Add initial data
            const batch = firestore.batch();
            addItemInBatch(batch, { value: "A" }, collectionRef, "id1");
            return batch.commit().then(() => collection.fetchAsync());
        });

        afterEach(() => collection.dispose());

        describe("when documents are changed while collection is not being watched", () => {
            test('it should not update documents in local docs', () => {
                return collectionRef.doc("id1").set({
                    value: "B"
                }).then(() => {
                    const doc = collection.get("id1");
                    expect(doc).toBeDefined();

                    expect(doc!.data!.value).toBe("A");
                });
            });
        });

        describe("when documents are deleted while collection is not being watched", () => {
            test('it should not delete document in local docs', () => {
                // Verify document to be deleted exists
                const doc = collection.get("id1");
                expect(doc).toBeDefined();

                return collectionRef.doc("id1").delete()
                    .then(() => {
                        // Verify if document has not been deleted in local dictionary
                        const doc = collection.get("id1");
                        expect(doc).toBeDefined();
                    });
            });
        });

        describe("when documents are added while collection is not being watched", () => {
            test('it should not add documents in local docs', () => {
                return collectionRef.doc("id3").set({ value: "C" })
                    .then(() => {
                        // Verify if document has been added to local dictionary
                        const doc = collection.get("id3");
                        expect(doc).toBeUndefined();
                    });
            });
        });
    });
});