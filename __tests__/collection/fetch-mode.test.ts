import { Collection, ICollectionOptions, FetchMode } from '../../src';
import { autorun, when, reaction } from 'mobx';
import { logger, waitAsync } from '../utils';
import { addItemInBatch, initDatabase, clearFirestoreDataAsync, deleteFirebaseAppsAsync } from '../utils/firestore-utils';

const { db, collectionRef } = initDatabase("test-auto-fetch", "books");

export function createCollection<T, K = T>(options?: ICollectionOptions<T, K>) {
    return new Collection<T, K>(
        db,
        collectionRef,
        options,
        {
            logger
        }
    );
}

let collection: Collection<{value: string}>;

beforeEach(() => clearFirestoreDataAsync("test-auto-fetch"));

afterEach(() => collection.dispose());

afterAll(deleteFirebaseAppsAsync);

describe("With fetch mode = auto:", () => {
    beforeEach(() => {
        collection = createCollection();

        // Add initial data
        const batch = db.batch();
        addItemInBatch(batch, { value: "A" }, collectionRef);
        return batch.commit();
    });

    describe("when collection becomes observed", () => {
        test('it should fetch documents', () => {
            // When no observers, the collection should not be fetched
            expect(collection.isFetched).toBe(false);

            // Add a dummy observer
            reaction(() => collection.docs, () => {
                console.log(collection.docs.length);
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

    describe("when collection becomes unobserved", () => {

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
                .then(() => {
                    // Remove the observer
                    stopAutorun();

                    return waitAsync(1000).then(() => {
                        // Collection should stop listening for changes
                        expect(collection.isActive).toBe(false);

                        // Add a new document to the collection
                        return collectionRef.add({ value: "B" })
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
            const batch = db.batch();
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

                    collection.query = ref => ref.where("value", "==", "B");

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
                collection.query = ref => ref.where("value", "==", "B");

                expect(collection.isFetched).toBe(false);
                expect(collection.isLoading).toBe(false);
            });
        });

        describe("to null", () => {
            test("it should clear the documents", () => {
                autorun(() => {
                    jest.fn()(collection.docs.length);
                });

                return when(() => collection.isFetched).then(() => {
                    collection.query = null;

                    return when(() => collection.isFetched)
                        .then(() => {
                            expect(collection.docs.length).toBe(0);
                        });
                });
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
    beforeEach(() => {
        collection = createCollection({
            fetchMode: FetchMode.manual
        });

        // Add initial data
        const batch = db.batch();
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
