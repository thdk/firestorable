import { initializeTestEnvironment, RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { Collection, ICollectionOptions, FetchMode, RealtimeMode } from "../..";
import { logger, addItemInBatch } from "../../__test-utils__";

import {FirebaseFirestore} from "@firebase/firestore-types";
import { CollectionReference, collection, writeBatch, setDoc, doc, addDoc, deleteDoc, query, where } from "firebase/firestore";

describe("realtime mode", () => {
    let booksCollection: Collection<{ value: string }>;
    let testEnv: RulesTestEnvironment;
    let collectionRef: CollectionReference<any>;
    let firestore: FirebaseFirestore;

    beforeAll(async () => {
        testEnv = await initializeTestEnvironment({
            projectId: "test-real-time-mode",
            firestore: {
                host: "localhost",
                port: 8080,
            }
        });

        firestore = testEnv.unauthenticatedContext().firestore();
        collectionRef = collection(firestore, "books");
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
            booksCollection = createCollection({ fetchMode: FetchMode.manual });

            // Add initial data
            const batch = writeBatch(firestore);
            addItemInBatch(batch, { value: "A" }, collectionRef, "id1");
            return batch.commit().then(() => booksCollection.fetchAsync());
        });

        afterEach(() => booksCollection.dispose());

        describe("when documents are changed while watching the collection", () => {
            test('it should update documents in local docs', () => {
                return setDoc(doc(collectionRef, "id1"), {
                    value: "B"
                }).then(() => {
                    const doc = booksCollection.get("id1");
                    expect(doc).toBeDefined();

                    expect(doc!.data!.value).toBe("B");
                });
            });
        });

        describe("when documents are deleted while watching the collection", () => {
            describe("when the collection is not filtered", () => {
                test('it should delete document in local docs', () => {
                    // Add one more document so we are not removing the last one (see next test)
                    return addDoc(collectionRef, { value: "foo" }).then(() => {
                        // Verify document to be deleted exists
                        const document = booksCollection.get("id1");
                        expect(document).toBeDefined();

                        return deleteDoc(doc(collectionRef, "id1"))
                            .then(() => {
                                // Verify if document has been deleted in local dictionary
                                const docRef = booksCollection.get("id1");
                                expect(docRef).toBeUndefined();
                            });
                    });
                });

                /** When deleting last document of collection, an emtpy snapshot is received instead of a snapshot with type = deleted */
                test('it should delete document in local docs even if its the last one', () => {
                    // Verify document to be deleted exists
                    const document = booksCollection.get("id1");
                    expect(document).toBeDefined();

                    return deleteDoc(doc(collectionRef, "id1"))
                        .then(() => {
                            // Verify if document has been deleted in local dictionary
                            const doc = booksCollection.get("id1");
                            expect(doc).toBeUndefined();
                        });
                });
            });

            describe("when the collection is filtered", () => {
                beforeEach(() => {
                    booksCollection.dispose();

                    booksCollection = createCollection({
                        fetchMode: FetchMode.manual,
                        query: (ref) => query(ref, where("value", "==", "A")),
                    });

                    return booksCollection.fetchAsync();
                });

                test('it should delete document in local docs', () => {
                    // Add one more document so we are not removing the last one (see next test)
                    return addDoc(collectionRef, { value: "A" }).then(() => {
                        // Verify document to be deleted exists
                        const document = booksCollection.get("id1");
                        expect(document).toBeDefined();

                        return deleteDoc(doc(collectionRef, "id1"))
                            .then(() => {
                                // Verify if document has been deleted in local dictionary
                                const doc = booksCollection.get("id1");
                                expect(doc).toBeUndefined();
                            });
                    });
                });

                /** When deleting last document of collection, an emtpy snapshot is received instead of a snapshot with type = deleted */
                test('it should delete document in local docs even if its the last one', () => {
                    // Verify document to be deleted exists
                    const documemt = booksCollection.get("id1");
                    expect(documemt).toBeDefined();

                    return deleteDoc(doc(collectionRef, "id1"))
                        .then(() => {
                            // Verify if document has been deleted in local dictionary
                            const doc = booksCollection.get("id1");
                            expect(doc).toBeUndefined();
                        });
                });
            });

        });

        describe("when documents are added while watching the collection", () => {
            test('it should add documents in local docs', () => {
                return setDoc(doc(collectionRef, "id3"), { value: "C" })
                    .then(() => {
                        // Verify if document has been added to local dictionary
                        const doc = booksCollection.get("id3");
                        expect(doc).toBeDefined();
                    });
            });
        });
    });

    describe("With realtime mode = off:", () => {
        beforeEach(() => {
            booksCollection = createCollection({ realtimeMode: RealtimeMode.off, fetchMode: FetchMode.manual });

            // Add initial data
            const batch = writeBatch(firestore);
            addItemInBatch(batch, { value: "A" }, collectionRef, "id1");
            return batch.commit().then(() => booksCollection.fetchAsync());
        });

        afterEach(() => booksCollection.dispose());

        describe("when documents are changed while collection is not being watched", () => {
            test('it should not update documents in local docs', () => {
                return setDoc(doc(collectionRef, "id1"), {
                    value: "B"
                }).then(() => {
                    const doc = booksCollection.get("id1");
                    expect(doc).toBeDefined();

                    expect(doc!.data!.value).toBe("A");
                });
            });
        });

        describe("when documents are deleted while collection is not being watched", () => {
            test('it should not delete document in local docs', () => {
                // Verify document to be deleted exists
                const document = booksCollection.get("id1");
                expect(document).toBeDefined();

                return deleteDoc(doc(collectionRef, "id1"))
                    .then(() => {
                        // Verify if document has not been deleted in local dictionary
                        const doc = booksCollection.get("id1");
                        expect(doc).toBeDefined();
                    });
            });
        });

        describe("when documents are added while collection is not being watched", () => {
            test('it should not add documents in local docs', () => {
                return setDoc(doc(collectionRef, "id3"), { value: "C" })
                    .then(() => {
                        // Verify if document has been added to local dictionary
                        const doc = booksCollection.get("id3");
                        expect(doc).toBeUndefined();
                    });
            });
        });
    });
});