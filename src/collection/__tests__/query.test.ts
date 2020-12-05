import { Collection, ICollectionOptions } from "../..";
import { logger } from "../../__test-utils__";
import { when, autorun } from "mobx";
import { initTestFirestore } from "../../../utils/test-firestore";

const {
    clearFirestoreData,
    refs: [collectionRef],
    firestore,
    deleteFirebaseApp,
} = initTestFirestore(
    "test-query",
    ["books"],
);

export function createCollection<T, K = T>(options?: ICollectionOptions<T, K>) {
    return new Collection<T, K>(
        firestore,
        collectionRef,
        options,
        {
            logger: logger
        }
    );
}

let collection: Collection<{ value: string }>;

beforeEach(() => clearFirestoreData());

afterEach(() => collection.dispose());

afterAll(deleteFirebaseApp);

describe("Collection.query", () => {

    beforeEach(() => {
        collection = createCollection();

        return collection.addAsync({ value: "A" });
    });

    test("it should clear the documents when set to null", () => {
        // Add a dummy observer to documents will get fetched
        autorun(() => {
            jest.fn()(collection.docs);
        });

        return when(() => collection.isFetched)
            .then(() => {
                expect(collection.docs.length).toBe(1);

                collection.query = null;

                return when(() => collection.isFetched)
                    .then(() => {
                        expect(collection.docs.length).toBe(0);
                    });
            });
    });

    test("it should clear the documents when set to null even if collection is not being observed anymore", () => {
        // Add a dummy observer to documents will get fetched
        const unobserve = autorun(() => {
            jest.fn()(collection.docs);
        });

        return when(() => collection.isFetched)
            .then(() => {
                expect(collection.docs.length).toBe(1);

                unobserve();

                collection.query = null;

                expect(collection.docs.length).toBe(0);
            });
    });
});