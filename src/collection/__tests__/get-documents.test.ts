import { Collection, ICollectionOptions, Doc } from "../..";
import { logger, IBook, addItemInBatch } from "../../__test-utils__";
import { initTestFirestore } from "../../../utils/test-firestore";

const {
    firestore,
    refs: [collectionRef],
    clearFirestoreData,
    deleteFirebaseApp,
} = initTestFirestore(
    "test-get-documents",
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

describe("Collection.getAsync", () => {

    beforeEach(() => {
        // Add initial data
        const batch = firestore.batch();
        addItemInBatch(batch, { total: 1, name: "A" }, collectionRef, "id1");
        addItemInBatch(batch, { total: 2, name: "B" }, collectionRef, "id2");
        addItemInBatch(batch, { total: 3, name: "C" }, collectionRef, "id3");

        return batch.commit();
    });

    describe("when the requested document exists", () => {
        test("it should get the document with the given id", () => {
            const collection = createCollection<IBook>();

            return collection.getAsync("id2")
                .then(doc => {
                    expect(doc.id).toBe("id2");
                    expect(doc.data).toBeDefined();
                    expect(doc.data!).toMatchObject({
                        name: "B"
                    });
                });
        });
    });

    describe("when the requested document does not exist", () => {
        test("it should throw", () => {
            const collection = createCollection<IBook>();

            return expect(collection.getAsync("id-0")).rejects.toBeDefined();
        });
    });
});

describe("Collection.getManyAsync", () => {

    beforeEach(() => {
        // Add initial data
        const batch = firestore.batch();
        addItemInBatch(batch, { total: 1, name: "A" }, collectionRef, "id1");
        addItemInBatch(batch, { total: 2, name: "B" }, collectionRef, "id2");
        addItemInBatch(batch, { total: 3, name: "C" }, collectionRef, "id3");
        addItemInBatch(batch, { total: 4, name: "D" }, collectionRef, "id4");

        return batch.commit();
    });

    describe("when the requested documents exist", () => {
        test("it should get the documenst with the given ids", () => {
            const collection = createCollection<IBook>();

            return collection.getManyAsync(["id2", "id4"])
                .then(results => {
                    expect(results.length).toBe(2);

                    const book1 = results[0] as Doc<IBook>;
                    expect(book1.id).toBe("id2");
                    expect(book1.data).toMatchObject({ total: 2, name: "B" });
                });
        });
    });

    describe("when some of the requested documents do not exist", () => {
        test("it should get the documents with the given ids and the id of documents that were not found", () => {
            const collection = createCollection<IBook>();

            return collection.getManyAsync(["id2", "id0", "id4"])
                .then(results => {
                    expect(results.length).toBe(3);

                    expect(results[1]).toBe("id0");
                });
        });
    });
});