import { Collection, ICollectionOptions } from "../..";
import { initDatabase, deleteFirebaseApps } from "../utils/firestore-utils";
import { logger } from "../utils";
import { when, autorun } from "mobx";

const {
    clearFirestoreDataAsync,
    collectionRef,
    db,
} = initDatabase("test-query", "books");

export function createCollection<T, K = T>(options?: ICollectionOptions<T, K>) {
    return new Collection<T, K>(
        db,
        collectionRef,
        options,
        {
            logger: logger
        }
    );
}

let collection: Collection<{ value: string }>;

beforeEach(() => clearFirestoreDataAsync());

afterEach(() => collection.dispose());

afterAll(deleteFirebaseApps);

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