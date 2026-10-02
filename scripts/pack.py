"""Build Chromium (Edge/Chrome) release ZIP."""
from pack_common import package_release

if __name__ == "__main__":
    package_release("manifest.json", "pinterest-cleaner-chromium.zip")
