import { Collection, ICollectionOptions, RealtimeMode } from "../..";
import { logger } from "../utils";
import { initTestFirestore } from "../../utils/test-firestore";

const {
    firestore,
    refs: [collectionRef],
    clearFirestoreData,
    deleteFirebaseApp,
} = initTestFirestore(
    "test-delete-documents",
    ["books"]
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

describe("Collection.deleteAsync", () => {

    beforeEach(() => {
        // Add initial data
        return Promise.all([
            collectionRef.doc("id1").set({ total: 1, name: "A" }),
            collectionRef.doc("id2").set({ total: 2, name: "B" }),
            collectionRef.doc("id3").set({ total: 3, name: "C" }),
            collectionRef.doc("id4").set({ total: 2, name: "C" }),
        ]);
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
