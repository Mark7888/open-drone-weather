#!/bin/zsh

npx expo prebuild

cd android
./gradlew assembleRelease --info
