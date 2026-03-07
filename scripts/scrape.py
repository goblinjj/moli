#!/usr/bin/env python3
"""Scrape recipe data and item images from cgs.hk produce pages."""

import json
import os
import re
import sys
from pathlib import Path

import requests
from bs4 import BeautifulSoup

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "src" / "data"
ITEMS_DIR = BASE_DIR / "public" / "items"

PAGES = {
    "bow": "https://cgs.hk/produce4.htm",
    "cooking": "https://cgs.hk/produce17.htm",
}

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "Mozilla/5.0"})

downloaded_images: set[str] = set()


def fetch_page(url: str) -> BeautifulSoup:
    resp = SESSION.get(url, timeout=30)
    resp.raise_for_status()
    resp.encoding = resp.apparent_encoding
    return BeautifulSoup(resp.text, "html.parser")


def get_image_base(soup: BeautifulSoup) -> str:
    meta = soup.find("meta", attrs={"name": "igbase"})
    if meta and meta.get("content"):
        return meta["content"].strip()
    return "ig2.cgs.hk"


def image_url(base: str, hash_val: str) -> str:
    return f"https://{base}/g/{hash_val[:2]}/{hash_val}.png"


def download_image(base: str, hash_val: str) -> None:
    if not hash_val or hash_val in downloaded_images:
        return
    downloaded_images.add(hash_val)
    dest = ITEMS_DIR / f"{hash_val}.png"
    if dest.exists():
        return
    url = image_url(base, hash_val)
    try:
        resp = SESSION.get(url, timeout=15)
        resp.raise_for_status()
        dest.write_bytes(resp.content)
        print(f"  Downloaded {hash_val}.png")
    except Exception as e:
        print(f"  WARNING: Failed to download {hash_val}.png: {e}")


def parse_material_level(img_tag) -> int:
    """Extract material level from title='等級N'."""
    title = img_tag.get("title", "") if img_tag else ""
    m = re.search(r"等級(\d+)", title)
    return int(m.group(1)) if m else 1


def parse_variant(text: str):
    """Parse variant text like '1A' into (level, variant_letter)."""
    text = text.strip()
    m = re.match(r"(\d+)\s*([A-Za-z])", text)
    if m:
        return int(m.group(1)), m.group(2).upper()
    # fallback: try just a number
    m2 = re.match(r"(\d+)", text)
    if m2:
        return int(m2.group(1)), "A"
    return 1, "A"


def parse_quantity(td) -> int | None:
    """Extract quantity from a <td class='quantity'> cell."""
    span = td.find("span")
    if span:
        m = re.search(r"x\s*(\d+)", span.get_text())
        if m:
            return int(m.group(1))
    return None


def scrape_category(category: str, url: str) -> list[dict]:
    print(f"Scraping {category} from {url}")
    soup = fetch_page(url)
    ig_base = get_image_base(soup)
    print(f"  Image base: {ig_base}")

    recipes = []
    tbodies = soup.find_all("tbody", id=re.compile(r"^\d+$"))
    print(f"  Found {len(tbodies)} tbody blocks")

    for tbody in tbodies:
        try:
            rows = tbody.find_all("tr", recursive=False)
            # Filter out sub rows
            main_rows = [r for r in rows if "sub" not in (r.get("class") or [])]
            if len(main_rows) < 3:
                continue

            row1, row2, row3 = main_rows[0], main_rows[1], main_rows[2]

            # Row 1: variant cell (rowspan=3), product image, materials
            row1_tds = row1.find_all("td", recursive=False)
            if len(row1_tds) < 2:
                continue

            # First td is variant
            variant_text = row1_tds[0].get_text(strip=True)
            level, variant_letter = parse_variant(variant_text)

            # Second td has product image
            product_img_tag = row1_tds[1].find("img")
            product_hash = ""
            if product_img_tag:
                product_hash = product_img_tag.get("data-src", "").strip()

            # Material tds (class="quantity")
            mat_tds_row1 = [td for td in row1_tds[2:] if "quantity" in (td.get("class") or [])]

            # Row 2: names (product name, then material names)
            row2_tds = row2.find_all("td", recursive=False)

            # Row 3: type + data-set values
            row3_tds = row3.find_all("td", recursive=False)

            # Product name from row2 first td
            product_name = row2_tds[0].get_text(strip=True) if row2_tds else ""

            # Build materials list
            materials = []
            for i, mat_td in enumerate(mat_tds_row1):
                qty = parse_quantity(mat_td)
                if qty is None:
                    continue

                mat_img = mat_td.find("img")
                mat_hash = mat_img.get("data-src", "").strip() if mat_img else ""
                mat_level = parse_material_level(mat_img)

                # Material name from row2 (offset by 1 for product name)
                mat_name_idx = i + 1
                mat_name = ""
                if mat_name_idx < len(row2_tds):
                    mat_name = row2_tds[mat_name_idx].get_text(strip=True)

                # Base quantity from row3 (offset by 1 for type)
                base_qty_idx = i + 1
                base_qty = qty
                if base_qty_idx < len(row3_tds):
                    bq_text = row3_tds[base_qty_idx].get_text(strip=True)
                    if bq_text.isdigit():
                        base_qty = int(bq_text)

                if mat_hash:
                    download_image(ig_base, mat_hash)

                materials.append({
                    "name": mat_name,
                    "quantity": base_qty,
                    "image": f"{mat_hash}.png" if mat_hash else "",
                    "materialLevel": mat_level,
                })

            if product_hash:
                download_image(ig_base, product_hash)

            recipe_id = f"{category}-{level}{variant_letter.lower()}"
            recipe = {
                "id": recipe_id,
                "name": product_name,
                "category": category,
                "level": level,
                "variant": variant_letter,
                "image": f"{product_hash}.png" if product_hash else "",
                "mpCost": level * 20,
                "materials": materials,
            }
            recipes.append(recipe)

        except Exception as e:
            tbody_id = tbody.get("id", "?")
            print(f"  WARNING: Failed to parse tbody id={tbody_id}: {e}")
            continue

    print(f"  Parsed {len(recipes)} recipes")
    return recipes


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    ITEMS_DIR.mkdir(parents=True, exist_ok=True)

    for category, url in PAGES.items():
        recipes = scrape_category(category, url)
        out_path = DATA_DIR / f"{category}.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(recipes, f, ensure_ascii=False, indent=2)
        print(f"  Saved {len(recipes)} recipes to {out_path}")

    print(f"\nTotal images downloaded: {len(downloaded_images)}")
    print("Done!")


if __name__ == "__main__":
    main()
