import { addItemInBatch, initDatabase, deleteFirebaseApps } from "../utils/firestore-utils";
import { Collection, ICollectionOptions, RealtimeMode } from "../..";
import { logger } from "../utils";

const { db, collectionRef, clearFirestoreDataAsync } = initDatabase("test-delete-documents", "books");

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

beforeEach(() => clearFirestoreDataAsync());

afterAll(deleteFirebaseApps);

describe("Collection.deleteAsync", () => {

    beforeEach(() => {
        // Add initial data
        const batch = db.batch();
        addItemInBatch(batch, { total: 1, name: "A" }, collectionRef, "id1");
        addItemInBatch(batch, { total: 2, name: "B" }, collectionRef, "id2");
        addItemInBatch(batch, { total: 3, name: "C" }, collectionRef, "id3");
        addItemInBatch(batch, { total: 2, name: "C" }, collectionRef, "id4");
        return batch.commit();
    });

    describe("when collection is not filtered with a query", () => {
        test("it should delete the document with the given id", () => {
            const collection = createCollection({ realtimeMode: RealtimeMode.off });

            return collection.deleteAsync("id2")
                .then(() => {
                    return collectionRef.doc("id2").get()
                        .then(doc => {
                            expect(doc.exists).toBe(false);
                        });
                });
        });

        test("it should delete multiple documents", () => {
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
