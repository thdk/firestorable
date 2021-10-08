import { Collection, ICollectionOptions } from "../..";
import { logger, IBook, addItemInBatch } from "../../__test-utils__";
import { initializeTestEnvironment, RulesTestEnvironment } from "@firebase/rules-unit-testing";

import { collection, CollectionReference, doc, getDoc, writeBatch } from "firebase/firestore";

describe("Collection.updateAsync", () => {
    let testEnv: RulesTestEnvironment;
    let collectionRef: CollectionReference<any>;
    let firestore: any;

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
            projectId: "test-update-documents",
            firestore: {
                host: "localhost",
                port: 8080,
            }
        });

        firestore = testEnv.unauthenticatedContext().firestore();
        collectionRef = collection(firestore, "books");
    });

    beforeEach(() => testEnv.clearFirestore());

    afterAll(() => testEnv.cleanup());

    describe("when the original documents exist in the collection", () => {
        let collection: Collection<IBook>;

        beforeEach(() => {
            collection = createCollection<IBook>({
                serialize: data => {
                    if (data === null) {
                        return {
                            isDeleted: true,
                        }
                    }
                    return data;
                },
            });

            // Add initial data
            const batch = writeBatch(firestore);
            addItemInBatch(batch, { total: 1, name: "A" }, collectionRef, "id1");
            addItemInBatch(batch, { total: 2, name: "B" }, collectionRef, "id2");
            addItemInBatch(batch, { total: 3, name: "C" }, collectionRef, "id3");

            return batch.commit();
        });

        afterEach(() => collection.dispose());

        test("it should update the document with the given id", () => {
            return collection.updateAsync({ total: 10 }, "id2")
                .then(() => {
                    return getDoc(doc(collectionRef, "id2"))
                        .then(snapshot => {
                            expect(snapshot.data()!.total).toBe(10);
                        })
                });
        });

        test("it should update the documents with the given ids", () => {
            return collection.updateAsync({ total: 10 }, "id1", "id2")
                .then(() => {
                    return Promise.all([
                        getDoc(doc(collectionRef, "id1")),
                        getDoc(doc(collectionRef, "id2")),
                        getDoc(doc(collectionRef, "id3")),
                    ])
                        .then(([snapshot1, snapshot2, snapshot3]) => {
                            expect(snapshot1.data()!.name).toBe("A");
                            expect(snapshot1.data()!.total).toBe(10);

                            expect(snapshot2.data()!.name).toBe("B");
                            expect(snapshot2.data()!.total).toBe(10);

                            expect(snapshot3.data()!.name).toBe("C");
                            expect(snapshot3.data()!.total).toBe(3);
                        });
                });
        });

        test("it should allow null value", () => {
            return collection.updateAsync(null, "id2")
                .then(() => getDoc(doc(collectionRef, "id2"))
                    .then(snapshot => {
                        expect(snapshot.data()!.isDeleted).toBe(true);
                        expect(snapshot.data()!.name).toBe("B");
                    })
                );
        });
    });

    describe("when the original documents do not exist in the collection", () => {
        let collection: Collection<IBook>;

        beforeEach(() => {
            collection = createCollection();
        });

        afterEach(() => collection.dispose());

        test("it should not add or update the document with the given id", () => {
            const id = "id2";
            let promise: Promise<any> = getDoc(doc(collectionRef, id))

            // First verify the document did not exist
            promise = promise.then(snapshot => {
                expect(snapshot.exists()).toBe(false);
            });

            // Try to update the document that does not exist
            return promise.then(() => {
                return collection.updateAsync({ total: 10 }, id)
                    .then(() => {
                        return getDoc(doc(collectionRef, id))
                            .then(snapshot => {
                                // Verify the document still does not exist
                                expect(snapshot.exists()).toBe(false);
                            });
                    });
            });
        });
    });
});
