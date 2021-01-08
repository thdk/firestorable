FROM alpine
RUN apk update \
    && apk add \
        nodejs \
        git \
        npm \
    && apk --no-cache add openjdk11 --repository=http://dl-cdn.alpinelinux.org/alpine/edge/community \
    && npm install -g firebase-tools \
    && firebase setup:emulators:firestore
