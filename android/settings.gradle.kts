pluginManagement {
    repositories {
        google()
        // Google's mirror of Maven Central first: Maven Central rate-limits shared CI and cloud
        // IPs (429 Too Many Requests), and the mirror doesn't.
        maven("https://maven-central.storage-download.googleapis.com/maven2/")
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        // Google's mirror of Maven Central first: Maven Central rate-limits shared CI and cloud
        // IPs (429 Too Many Requests), and the mirror doesn't.
        maven("https://maven-central.storage-download.googleapis.com/maven2/")
        mavenCentral()
    }
}
rootProject.name = "Cue"
include(":app")
