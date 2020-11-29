import { Collection, ICollectionOptions, FetchMode } from '../..';
import { autorun, when, reaction } from 'mobx';
import { logger, waitAsync } from '../utils';
import { addItemInBatch } from '../utils/firestore-utils';
import { waitFor } from '@testing-library/dom';
import { initTestFirestore } from '../../utils/test-firestore';

const {
    firestore,
    refs: [collectionRef],
    clearFirestoreData,
    deleteFirebaseApp,
} = initTestFirestore(
    "test-auto-fetch", 
    ["books"],
);

export function createCollection<T, K = T>(options?: ICollectionOptions<T, K>) {
    return new Collection<T, K>(
        firestore,
        collectionRef,
        options,
        {
            logger
        }
    );
}

let collection: Collection<{ value: string }>;

beforeEach(() => clearFirestoreData());

afterEach(() => collection.dispose());

afterAll(deleteFirebaseApp);

describe("With fetch mode = auto:", () => {
    beforeEach(() => {
        collection = createCollection();

        // Add initial data
        return collectionRef.add({ value: "A" });
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
                    await collectionRef.add({ value: "B" });

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
            const batch = firestore.batch();
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
                collection.query = ref => ref.where("value", "==", "B");

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
    beforeEach(() => {
        collection = createCollection({
            fetchMode: FetchMode.manual
        });

        // Add initial data
        const batch = firestore.batch();
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
    beforeEach(() => {

        // Add initial data
        return collectionRef.add(
            {
                value: "A",
            }
        ).then(() => {
            collection = createCollection({
                fetchMode: FetchMode.once,
            });
        });
    });

    describe("when collection is created", () => {
        test('it should immediately fetch documents', () => {
            return when(() => !collection.isLoading).then(() => {
                expect(collection.isFetched).toBe(true);
            });
        });
    });
});
