import { initDatabase, clearFirestoreDataAsync, deleteFirebaseAppsAsync } from "../utils/firestore-utils";
import { Collection, ICollectionOptions } from "../../src";
import { logger } from "../utils";

const projectId = "test-add-documents";
const { db, collectionRef } = initDatabase(projectId, "books");

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

beforeEach(() => clearFirestoreDataAsync(projectId));

afterAll(deleteFirebaseAppsAsync);

describe("Collection.addAsync", () => {
    const collection = createCollection<IBook>();

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

                return collection.addAsync({ total: 11, name: "Book" })
                    .then(id => {
                        return collectionRef.doc(id).get()
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
