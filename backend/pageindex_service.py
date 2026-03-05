import os
import asyncio
from pageindex import page_index_main, config
from pageindex.page_index_md import md_to_tree
from pageindex.utils import ConfigLoader


async def process_document(file_path: str):

    file_ext = file_path.lower().split(".")[-1]

    if file_ext == "pdf":

        opt = config(
            model="gpt-oss:120b-cloud",
            toc_check_page_num=20,
            max_page_num_each_node=10,
            max_token_num_each_node=6000,
            if_add_node_id="yes",
            if_add_node_summary="yes",
            if_add_doc_description="no",
            if_add_node_text="no"
        )

        tree = await page_index_main(file_path, opt)
        return tree

    elif file_ext in ["md", "markdown"]:

        config_loader = ConfigLoader()
        opt = config_loader.load({
            "model": "gpt-4o-2024-11-20",
            "if_add_node_summary": "yes",
            "if_add_doc_description": "no",
            "if_add_node_text": "no",
            "if_add_node_id": "yes"
        })

        tree = await md_to_tree(
            md_path=file_path,
            if_thinning=False,
            min_token_threshold=5000,
            if_add_node_summary=opt.if_add_node_summary,
            summary_token_threshold=200,
            model=opt.model,
            if_add_doc_description=opt.if_add_doc_description,
            if_add_node_text=opt.if_add_node_text,
            if_add_node_id=opt.if_add_node_id
        )

        return tree

    else:
        raise ValueError("Unsupported file type")
