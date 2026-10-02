"""Build Firefox release XPI."""
from pack_common import package_release

if __name__ == "__main__":
    package_release("manifest.firefox.json", "pinterest-cleaner-firefox.xpi")
