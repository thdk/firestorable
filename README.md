# Firestorable

A strong typed observable wrapper using mobx for firebase firestore database.

[![CircleCI](https://circleci.com/gh/thdk/firestorable/tree/master.svg?style=svg)](https://circleci.com/gh/thdk/firestorable/tree/master)
[![Coverage Status](https://coveralls.io/repos/github/thdk/firestorable/badge.svg?branch=master)](https://coveralls.io/github/thdk/firestorable?branch=master)

## How to use: basic example

Create an instance of a firestorable collection:
```js
const db = firebase.firestore();

// create a type or interface that matches the data in the firestore collection
interface IRegistration {
    time: number;
    description: string;
}

// use the interface as generic type when creating the firestorable collection
const registrationCollection = new Collection<IRegistration>(
  db,
  "registrations", // name of your firestore collection
);
```

And use that instance in a mobx observable react component:

```jsx
const RegistrationsList = observer(() => 
      <div className="registrations-list">
        {
            // Each item in the docs property of the create Collection has a strong typed (IRegistration) data property representing the document data from the firestore 'registrations' collection.
            registrationCollection.docs
                .map(doc => <div key={doc.id}>
                    <div>Time: {doc.data.time}</div>
                    <div>Description: {doc.data.description}</div>
                </div>)
        }
      </div>
  );
});
```

This RegistrationsList component will now rerender whenever changes occur in the 'registrations' collection of your firestore database.

I've also created a separate github repo to bundle  [example applications](https://github.com/thdk/firestorable-examples) that demonstrate how to use firestorable with react.


## Contributing

These instructions will get you a copy of the project for development and testing purposes.

### Prerequisites

You'll need node, npm and java installed.
(Java is needed to run the tests with a firestore emulotor)

### Installing

1. Clone this repo
```sh
git clone https://github.com/thdk/firestorable.git
```

2. Step into the new repo directory

```sh
cd firestorable
```

3. Install dependencies

```sh
npm install
```

4. Build
```sh
npm run build
```

### Testing
Before running the tests, you need to start to firestore emulator:
```sh
 npm run emulator
```
Keep the emulator running in one terminal window and run tests in another terminal:

```sh
 npm run test
```

Note: after running `npm run test` you can run `npm run coverage` to view the code coverage of the last ran tests.

Note: By default emulator will use port 8080. If you need to use another port, then you have to set the port number in firebase.json.

To make sure the tests run using the port set in firebase.json, run your tests a below:

```sh
firebase emulators:exec --only firestore jest
```

Above command will start the emulator, run 'jest', and stop the emulator after the tests.

## Built With

* [mobx](https://mobx.js.org/) - Simple, scalable state management
* [typescript](https://www.typescriptlang.org/) - Javascript that scales
* [jest](https://jestjs.io/) - Javascript testing framework
* [firebase](https://firebase.google.com/) - App development platform
* [npm](https://www.npmjs.com/) - Package manager
* [circleCI](https://circleci.com/) - Continuous Integration and Delivery

## Authors

* **Thomas Dekiere** - *Initial work* - [thdk](https://github.com/thdk)

## License

This project is licensed under the MIT License - see the [LICENSE.txt](LICENSE.txt) file for details


