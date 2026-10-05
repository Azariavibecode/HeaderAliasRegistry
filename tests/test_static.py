from pathlib import Path

SOURCE = (Path(__file__).parents[1] / "contracts/HeaderAliasRegistry.py").read_text(encoding="utf-8")

def test_runtime_and_storage():
    assert SOURCE.startswith("# v0.2.16") and "class Contract(gl.Contract):" in SOURCE
    for item in ["pairs: TreeMap[str, str]", "source_slots: TreeMap[str, str]", "target_slots: TreeMap[str, str]", "evidence: TreeMap[str, str]"]:
        assert item in SOURCE
    assert "self.pairs =" not in SOURCE

def test_graph_architecture_not_lineage_or_court():
    for item in ["create_version_pair", "propose_alias", "register_evidence", "seal_edge", "verify_alias", "publish_alias", "resolve_alias", "SOURCE_COLLISION", "TARGET_COLLISION"]:
        assert item in SOURCE
    for forbidden in ["challenge_deadline", "submit_rebuttal", "activate_compatible_release", "parent_commit", "appeal"]:
        assert forbidden not in SOURCE

def test_source_and_positive_gate():
    for item in ["/git/commits/", "/git/trees/", "_blob_sha1(raw.body)", "hashlib.sha256(raw.body).hexdigest()",
                 "same_direction", "same_purpose", "same_value_model", "scope_matches", "security_not_weakened",
                 "gl.eq_principle.prompt_comparative"]:
        assert item in SOURCE
    assert "gl.eq_principle.strict_eq" in SOURCE

def test_no_admin_or_clock():
    for forbidden in ["self.owner", "deployer", "only_owner", "datetime.now", "time.time", "deadline"]:
        assert forbidden not in SOURCE
