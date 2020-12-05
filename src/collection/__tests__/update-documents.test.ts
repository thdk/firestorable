import { Collection, ICollectionOptions } from "../..";
import { logger, IBook, addItemInBatch } from "../../__test-utils__";
import { initTestFirestore } from "../../../utils/test-firestore";

const {
    firestore,
    refs: [collectionRef],
    clearFirestoreData,
    deleteFirebaseApp,
} = initTestFirestore(
    "test-update-documents",
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

beforeEach(() => clearFirestoreData());

afterAll(deleteFirebaseApp);

describe("Collection.updateAsync", () => {

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
            const batch = firestore.batch();
            addItemInBatch(batch, { total: 1, name: "A" }, collectionRef, "id1");
            addItemInBatch(batch, { total: 2, name: "B" }, collectionRef, "id2");
            addItemInBatch(batch, { total: 3, name: "C" }, collectionRef, "id3");

            return batch.commit();
        });

        afterEach(() => collection.dispose());

        test("it should update the document with the given id", () => {
            return collection.updateAsync({ total: 10 }, "id2")
                .then(() => {
                    return collectionRef.doc("id2").get()
                        .then(snapshot => {
                            expect(snapshot.data()!.total).toBe(10);
                        })
                });
        });

        test("it should update the documents with the given ids", () => {
            return collection.updateAsync({ total: 10 }, "id1", "id2")
                .then(() => {
                    return Promise.all([
                        collectionRef.doc("id1").get(),
                        collectionRef.doc("id2").get(),
                        collectionRef.doc("id3").get(),
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
                .then(() => collectionRef.doc("id2").get()
                    .then(snapshot => {
                        expect(snapshot.data()!.isDeleted).toBe(true);
                        expect(snapshot.data()!.name).toBe("B");
                    })
                );
        });
    });

    describe("when the original documents do not exist in the collection", () => {
        const collection = createCollection();

        afterEach(() => collection.dispose());

        test("it should not add or update the document with the given id", () => {
            const id = "id2";
            let promise: Promise<any> = collectionRef.doc(id).get();

            // First verify the document did not exist
            promise = promise.then(snapshot => {
                expect(snapshot.exists).toBe(false);
            });

            // Try to update the document that does not exist
            return promise.then(() => {
                return collection.updateAsync({ total: 10 }, id)
                    .then(() => {
                        return collectionRef.doc(id).get()
                            .then(snapshot => {
                                // Verify the document still does not exist
                                expect(snapshot.exists).toBe(false);
                            });
                    });
            });
        });
    });
});
