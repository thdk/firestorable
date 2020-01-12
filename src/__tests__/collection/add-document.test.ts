import { initDatabase, deleteFirebaseAppsAsync } from "../utils/firestore-utils";

import { ICollectionOptions, Collection } from "../..";
import { logger } from "../utils";

const { db, collectionRef, clearFirestoreDataAsync } = initDatabase("test-add-documents", "books");

interface IBook {
    name: string;
    total: number;
    isDeleted?: boolean;
}

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

let collection: Collection<IBook>;

beforeEach(() => clearFirestoreDataAsync());

afterAll(deleteFirebaseAppsAsync);

describe("Collection.addAsync", () => {
    beforeEach(() => {
        collection = createCollection<IBook>();
    });

    describe("Adding a single document", () => {
        describe("when no forced id is provided", () => {
            test("it should add the document with a generated id", () => {

                return collection.addAsync({ total: 11, name: "Book" })
                    .then(id => {
                        return collectionRef.doc(id).get()
                            .then(snapshot => {
                                expect(snapshot.exists).toBe(true);
                            });
                    });
            });
        });

        describe("when a forced id is provided", () => {
            test("it should add the document with the given id", () => {

                return collection.addAsync(
                    { total: 11, name: "Book" },
                    "given-id"
                    )
                    .then(() => {
                        return collectionRef.doc("given-id").get()
                            .then(snapshot => {
                                expect(snapshot.exists).toBe(true);
                            });
                    });
            });
        });
    });

    describe("Adding multiple documents", () => {
        test("it should add the documents with generated ids", () => {

            return collection.addAsync([
                { total: 11, name: "Book" },
                { total: 22, name: "Book 2" }
            ])
                .then(ids => {
                    return Promise.all(
                        [
                            collectionRef.doc(ids[0]).get(),
                            collectionRef.doc(ids[1]).get(),
                        ]
                    ).then(([snapshot1, snapshot2]) => {
                        expect(snapshot1.exists).toBe(true);
                        expect(snapshot2.exists).toBe(true);
                    });
                });
        });
    });
});
