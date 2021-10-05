import { Collection, ICollectionOptions, FetchMode } from '../..';
import { autorun, when, reaction } from 'mobx';
import { logger, waitAsync, addItemInBatch } from "../../__test-utils__";
import { waitFor } from '@testing-library/dom';

import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';

import * as types from "@firebase/firestore-types";
import { addDoc, collection, CollectionReference, query, where, writeBatch } from 'firebase/firestore';

describe("fetch mode", () => {
    let collectionRef: CollectionReference<any>;
    let firestore: types.FirebaseFirestore;
    let testEnv: RulesTestEnvironment;

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

    beforeAll(async () => {
        testEnv = await initializeTestEnvironment({
            projectId: "test-auto-fetch",
            firestore: {
                host: "localhost",
                port: 8080,
            }
        });

        firestore = testEnv.unauthenticatedContext().firestore();
        collectionRef = collection(firestore, "books");
    });

    beforeEach(() => testEnv.clearFirestore());

    describe("With fetch mode = auto:", () => {
        let collection: Collection<{ value: string }>;
        afterEach(() => collection.dispose());

        beforeEach(() => {
            collection = createCollection();

            // Add initial data
            return addDoc(collectionRef, { value: "A" });
        });

        describe("when collection.docs becomes observed", () => {
            test('it should fetch documents', () => {
                // When no observers, the collection should not be fetched
                expect(collection.isFetched).toBe(false);

                // Add a dummy observer
                reaction(() => collection.docs, () => {
                    // console.log(collection.docs.length);
                });

                // Collection should start loading the documents when it becomes observed
                expect(collection.isLoading).toBe(true);

                // When loading is finished, the documents must be present in the collection
                return when(() => !collection.isLoading)
                    .then(() => {
                        expect(collection.docs.length).toBe(1);
                    });
            });
        });

        describe("when collection.docs becomes unobserved", () => {

            test('it should stop listening for document changes', () => {
                // When no observers, the collection should not be fetched
                expect(collection.isFetched).toBe(false);

                // Add a dummy observer
                const stopAutorun = autorun(() => {
                    jest.fn()(collection.docs);
                });

                // Collection should be listening for changes when it become observed
                expect(collection.isActive).toBe(true);

                // Collection should start loading the documents when it becomes observed
                expect(collection.isLoading).toBe(true);

                return when(() => !collection.isLoading)
                    .then(async () => {
                        // Remove the observer
                        stopAutorun();

                        // Collection should stop listening for changes
                        await waitFor(() => expect(collection.isActive).toBe(false));

                        // Add a new document to the collection
                        await addDoc(collectionRef, { value: "B" });

                        await waitAsync(50);

                        // The new document should not show up in the docs as we are not listening for changes
                        await waitFor(
                            () => expect(collection.docs.length).toBe(1),
                        );
                    });
            });
        });

        describe("when collection.isFetched becomes observed", () => {
            test('it should fetch documents', () => {
                // When no observers, the collection should not be fetched
                expect(collection.isFetched).toBe(false);

                // Add a dummy observer
                reaction(() => collection.isFetched, () => {
                    // console.log(collection.docs.length);
                });

                // Collection should start loading the documents when it becomes observed
                expect(collection.isLoading).toBe(true);

                // When loading is finished, the documents must be present in the collection
                return when(() => !collection.isLoading)
                    .then(() => {
                        expect(collection.docs.length).toBe(1);
                    });
            });
        });

        describe("when collection.isFetched becomes unobserved", () => {

            test('it should stop listening for document changes', () => {
                // When no observers, the collection should not be fetched
                expect(collection.isFetched).toBe(false);

                // Add a dummy observer
                const stopAutorun = autorun(() => {
                    jest.fn()(collection.isFetched);
                });

                // Collection should be listening for changes when it become observed
                expect(collection.isActive).toBe(true);

                // Collection should start loading the documents when it becomes observed
                expect(collection.isLoading).toBe(true);

                return when(() => !collection.isLoading)
                    .then(() => {
                        // Remove the observer
                        stopAutorun();

                        return waitAsync(1000).then(() => {
                            // Collection should stop listening for changes
                            expect(collection.isActive).toBe(false);

                            // Add a new document to the collection
                            return addDoc(collectionRef, { value: "B" })
                                .then(() => {
                                    // The new document should not show up in the docs as we are not listening for changes
                                    expect(collection.docs.length).toBe(1);
                                });
                        });

                    });
            });
        });

        describe("when query of collection changes", () => {
            beforeEach(() => {
                // Add extra document to initial data
                const batch = writeBatch(firestore);
                addItemInBatch(batch, { value: "B" }, collectionRef);
                return batch.commit();
            });

            describe("when the collection has active listeners", () => {
                test("it should fetch filtered documents", () => {
                    autorun(() => {
                        jest.fn()(collection.docs);
                    });

                    return when(() => collection.isFetched).then(() => {
                        // Verify initial state
                        expect(collection.docs.length).toBe(2);

                        collection.query = ref => query(ref, where("value", "==", "B"));

                        expect(collection.isFetched).toBe(false);

                        return when(() => collection.isFetched)
                            .then(() => {
                                expect(collection.docs.length).toBe(1);
                                expect(collection.docs[0].data!.value).toBe("B")
                            });
                    });

                });
            });

            describe("when the collection has no active listeners", () => {
                test("it should not fetch documents", () => {
                    const collection = createCollection();
                    collection.query = ref => query(ref, where("value", "==", "B"));

                    expect(collection.isFetched).toBe(false);
                    expect(collection.isLoading).toBe(false);
                });
            });
        });

        describe("when calling fetchAsync on the collection", () => {
            test("it should reject", () => {
                expect(collection.fetchAsync()).rejects.toBeDefined();
            });
        });
    });

    describe("With fetch mode = manual:", () => {
        let collection: Collection<{ value: string }>;
        beforeEach(() => {
            collection = createCollection({
                fetchMode: FetchMode.manual
            });

            // Add initial data
            const batch = writeBatch(firestore);
            addItemInBatch(batch, { value: "A" }, collectionRef);
            return batch.commit();
        });

        describe("when collection becomes observed", () => {
            test('it should not fetch documents', () => {
                // When no observers, the collection should not be fetched
                expect(collection.isFetched).toBe(false);

                // Add a dummy observer
                autorun(() => {
                    jest.fn()(collection.docs.length);
                });

                // Collection should not start loading the documents when it becomes observed
                expect(collection.isLoading).toBe(false);
                expect(collection.isFetched).toBe(false);
            });
        });
    });

    describe("With fetch mode = once:", () => {

        describe("when collection is created", () => {
            let collection: Collection<{ value: string }>;

            test('it should immediately fetch documents', async () => {
                // Add initial data
                await addDoc(collectionRef,
                    {
                        value: "A",
                    }
                ).then(() => {
                    collection = createCollection({
                        fetchMode: FetchMode.once,
                    });
                    console.log({
                        collection
                    })
                });
                expect(collection).toBeDefined();
                return when(() => !collection.isLoading).then(() => {
                    expect(collection.isFetched).toBe(true);
                });
            });
        });
    });
});