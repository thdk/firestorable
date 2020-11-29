import { Collection, ICollectionOptions } from "../..";
import { initTestFirestore } from "../../utils/test-firestore";
import { logger } from '../utils';

const { firestore, refs: [collectionRef] } = initTestFirestore(
    "test-new-id",
    ["books"],
);

export function createCollection<T, K = T>(options?: ICollectionOptions<T, K>) {
    return new Collection<T, K>(
        firestore,
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
