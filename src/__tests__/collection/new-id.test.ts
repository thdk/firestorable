import { Collection, ICollectionOptions } from "../..";
import { initDatabase } from "../utils/firestore-utils";
import { logger } from '../utils';

const { db, collectionRef } = initDatabase("test-new-id", "books");

export function createCollection<T, K = T>(options?: ICollectionOptions<T, K>) {
    return new Collection<T, K>(
        db,
        collectionRef,
        options,
        {
            logger,
        },
    );
}

describe("Collection.newId", () => {
    it("should return a string", () => {
        const collection = createCollection();
        expect(typeof collection.newId()).toBe("string");
    });
});
