import hashlib, json
from pathlib import Path
import pytest

ROOT = Path(__file__).parents[1]
OWNER, REPO = "AzariaFixture", "HeaderAliasSources"
OLD, NEW, BAD = "1" * 40, "2" * 40, "3" * 40
PATH_OLD, PATH_NEW, PATH_MIGRATION = "/docs/v1/headers.md", "/docs/v2/headers.md", "/migration/v1-v2.md"
BODIES = {
    (OLD, PATH_OLD): (ROOT / "fixtures/old/headers.md").read_bytes(),
    (NEW, PATH_NEW): (ROOT / "fixtures/new-equivalent/headers.md").read_bytes(),
    (NEW, PATH_MIGRATION): (ROOT / "fixtures/migration/guide.md").read_bytes(),
    (BAD, PATH_NEW): (ROOT / "fixtures/new-mismatch/headers.md").read_bytes(),
    (BAD, PATH_MIGRATION): (ROOT / "fixtures/migration/mismatch-guide.md").read_bytes(),
}
TREES = {OLD: "a" * 40, NEW: "b" * 40, BAD: "c" * 40}
sha = lambda body: hashlib.sha256(body).hexdigest()
blob = lambda body: hashlib.sha1((f"blob {len(body)}\0").encode() + body).hexdigest()

def source(commit, path, marker, digest=None):
    body = BODIES[(commit, path)]
    return json.dumps({"owner": OWNER, "repo": REPO, "commit": commit, "path": path,
                       "digest": digest or sha(body), "marker": marker})

def result(kind, edge=0):
    values = {
        "valid": "FULLY_EQUIVALENT",
        "mismatch": "PURPOSE_CHANGED",
        "ambiguous": "AMBIGUOUS_EVIDENCE",
    }
    return json.dumps({"reason_code": values[kind]})

def mock_commit(vm, commit, paths, missing=None, bad_blob=False):
    api = f"https://api.github.com/repos/{OWNER}/{REPO}"; tree = TREES[commit]
    entries = [{"path": path[1:], "type": "blob", "mode": "100644", "size": len(BODIES[(commit, path)]),
                "sha": "0" * 40 if bad_blob else blob(BODIES[(commit, path)])} for path in paths]
    vm.mock_web((api + "/git/commits/" + commit).replace(".", r"\.") + "$",
                {"status": 200, "body": json.dumps({"sha": commit, "tree": {"sha": tree}}).encode()})
    vm.mock_web((api + "/git/trees/" + tree + r"\?recursive=1$").replace(".", r"\."),
                {"status": 200, "body": json.dumps({"truncated": False, "tree": entries}).encode()})
    for path in paths:
        url = f"https://raw.githubusercontent.com/{OWNER}/{REPO}/{commit}{path}"
        vm.mock_web(url.replace(".", r"\.") + "$", {"status": 404 if path == missing else 200,
                                                        "body": BODIES[(commit, path)]})

def mock_sources(vm, candidate=NEW, **kwargs):
    mock_commit(vm, OLD, [PATH_OLD])
    mock_commit(vm, candidate, [PATH_NEW, PATH_MIGRATION], **kwargs)

def deploy(vm, direct_deploy, actor):
    vm.strict_mocks = True; vm.check_pickling = True
    with vm.prank(actor): return direct_deploy("contracts/HeaderAliasRegistry.py")

@pytest.fixture
def setup(direct_vm, direct_deploy, direct_alice):
    return direct_vm, deploy(direct_vm, direct_deploy, direct_alice), direct_alice

def create_pair(vm, contract, actor, policy="ONE_TO_ONE"):
    with vm.prank(actor): return contract.create_version_pair("acme-api", "v1", "v2", OWNER, REPO, policy)

def propose(vm, contract, actor, old_header="X-Request-Trace", new_header="Trace-Context", candidate=NEW):
    migration_marker = "## MIGRATION X-Request-Trace TO " + new_header
    with vm.prank(actor):
        return contract.propose_alias(0, old_header, new_header, "REQUEST",
            source(OLD, PATH_OLD, "## HEADER X-Request-Trace"),
            source(candidate, PATH_NEW, "## HEADER " + new_header),
            source(candidate, PATH_MIGRATION, migration_marker))

def acquire_and_seal(contract, edge_id):
    for slot in ["OLD_REFERENCE", "NEW_REFERENCE", "MIGRATION_GUIDE"]:
        assert contract.register_evidence(edge_id, slot) == "EVIDENCE_REGISTERED"
    assert contract.seal_edge(edge_id) == "SEALED"

def test_happy_publish_and_resolve(setup, direct_bob):
    vm, contract, deployer = setup; assert create_pair(vm, contract, direct_bob) == 0
    assert propose(vm, contract, direct_bob) == 0; mock_sources(vm); acquire_and_seal(contract, 0)
    vm.mock_llm(r"Verify one proposed HTTP header rename.*", result("valid"))
    assert contract.verify_alias(0) == "VERIFIED_ALIAS"
    assert contract.publish_alias(0) == "PUBLISHED"
    resolved = json.loads(contract.resolve_alias(0, "x-request-trace"))
    assert resolved["new_header"] == "Trace-Context" and resolved["edge_id"] == 0

def test_semantic_mismatch_never_resolves(setup, direct_bob):
    vm, contract, _ = setup; create_pair(vm, contract, direct_bob)
    assert propose(vm, contract, direct_bob, new_header="Retry-Delay", candidate=BAD) == 0
    mock_sources(vm, BAD); acquire_and_seal(contract, 0); vm.mock_llm(r"Verify one proposed HTTP header rename.*", result("mismatch"))
    assert contract.verify_alias(0) == "SEMANTIC_MISMATCH"
    assert contract.publish_alias(0) == "EDGE_NOT_PUBLISHABLE"
    assert "error" in json.loads(contract.resolve_alias(0, "X-Request-Trace"))

@pytest.mark.parametrize("failure", ["digest", "missing", "blob"])
def test_source_failures_fail_closed(setup, direct_bob, failure):
    vm, contract, _ = setup; create_pair(vm, contract, direct_bob)
    old = source(OLD, PATH_OLD, "## HEADER X-Request-Trace")
    candidate = source(NEW, PATH_NEW, "## HEADER Trace-Context", "0" * 64 if failure == "digest" else None)
    migration = source(NEW, PATH_MIGRATION, "## MIGRATION X-Request-Trace TO Trace-Context")
    with vm.prank(direct_bob): contract.propose_alias(0, "X-Request-Trace", "Trace-Context", "REQUEST", old, candidate, migration)
    mock_commit(vm, OLD, [PATH_OLD]); mock_commit(vm, NEW, [PATH_NEW],
        missing=PATH_NEW if failure == "missing" else None, bad_blob=failure == "blob")
    assert contract.register_evidence(0, "OLD_REFERENCE") == "EVIDENCE_REGISTERED"
    assert contract.register_evidence(0, "NEW_REFERENCE") == "SOURCE_UNVERIFIED"
    assert contract.seal_edge(0) == "EVIDENCE_INCOMPLETE"
    assert contract.publish_alias(0) == "EDGE_NOT_PUBLISHABLE"

def test_source_collision_is_deterministic(setup, direct_bob):
    vm, contract, _ = setup; create_pair(vm, contract, direct_bob)
    propose(vm, contract, direct_bob); mock_sources(vm); acquire_and_seal(contract, 0)
    vm.mock_llm(r"Verify one proposed HTTP header rename.*", result("valid", 0)); contract.verify_alias(0)
    # A second independently verified edge competes for the same source slot.
    with vm.prank(direct_bob):
        contract.propose_alias(0, "X-Request-Trace", "Request-Correlation", "REQUEST",
            source(OLD, PATH_OLD, "## HEADER X-Request-Trace"),
            source(NEW, PATH_NEW, "## HEADER Trace-Context"),
            source(NEW, PATH_MIGRATION, "## MIGRATION X-Request-Trace TO Trace-Context"))
    acquire_and_seal(contract, 1); vm._llm_mocks.clear(); vm.mock_llm(r"Verify one proposed HTTP header rename.*", result("valid", 1)); contract.verify_alias(1)
    assert contract.publish_alias(0) == "PUBLISHED"
    counts = json.loads(contract.get_counts()); resolved = contract.resolve_alias(0, "X-Request-Trace")
    assert contract.publish_alias(1) == "SOURCE_COLLISION"
    assert contract.resolve_alias(0, "X-Request-Trace") == resolved
    after = json.loads(contract.get_counts())
    assert after["published_count"] == counts["published_count"] and after["collision_count"] == counts["collision_count"] + 1

def test_target_collision_one_to_one(setup, direct_bob):
    vm, contract, _ = setup; create_pair(vm, contract, direct_bob)
    propose(vm, contract, direct_bob); mock_sources(vm); acquire_and_seal(contract, 0)
    vm.mock_llm(r"Verify one proposed HTTP header rename.*", result("valid", 0)); contract.verify_alias(0); contract.publish_alias(0)
    with vm.prank(direct_bob):
        contract.propose_alias(0, "X-Correlation", "Trace-Context", "REQUEST",
            source(OLD, PATH_OLD, "## HEADER X-Request-Trace"), source(NEW, PATH_NEW, "## HEADER Trace-Context"),
            source(NEW, PATH_MIGRATION, "## MIGRATION X-Request-Trace TO Trace-Context"))
    acquire_and_seal(contract, 1); vm._llm_mocks.clear(); vm.mock_llm(r"Verify one proposed HTTP header rename.*", result("valid", 1)); contract.verify_alias(1)
    assert contract.publish_alias(1) == "TARGET_COLLISION"

def test_bad_positive_and_prompt_identity_are_inconclusive(setup, direct_bob):
    vm, contract, _ = setup; create_pair(vm, contract, direct_bob); propose(vm, contract, direct_bob); mock_sources(vm); acquire_and_seal(contract, 0)
    payload = json.loads(result("valid")); payload["unexpected"] = True
    vm.mock_llm(r"Verify one proposed HTTP header rename.*", json.dumps(payload))
    assert contract.verify_alias(0) == "INCONCLUSIVE"

def test_prompt_injection_cannot_change_edge_identity(setup, direct_bob):
    vm, contract, _ = setup; create_pair(vm, contract, direct_bob); propose(vm, contract, direct_bob); mock_sources(vm); acquire_and_seal(contract, 0)
    payload = {"reason_code": "PUBLISH_NOW"}
    vm.mock_llm(r"Verify one proposed HTTP header rename.*", json.dumps(payload))
    assert contract.verify_alias(0) == "INCONCLUSIVE"
    assert contract.publish_alias(0) == "EDGE_NOT_PUBLISHABLE"

def test_wrong_authority_and_revision_are_rejected(setup, direct_bob):
    vm, contract, _ = setup; create_pair(vm, contract, direct_bob)
    old = json.loads(source(OLD, PATH_OLD, "## HEADER X-Request-Trace")); old["repo"] = "OtherRepo"
    with vm.prank(direct_bob):
        assert contract.propose_alias(0, "X-Request-Trace", "Trace-Context", "REQUEST", json.dumps(old),
            source(NEW, PATH_NEW, "## HEADER Trace-Context"),
            source(NEW, PATH_MIGRATION, "## MIGRATION X-Request-Trace TO Trace-Context")) == "AUTHORITY_MISMATCH"
        migration = json.loads(source(NEW, PATH_MIGRATION, "## MIGRATION X-Request-Trace TO Trace-Context"))
        migration["commit"] = OLD
        assert contract.propose_alias(0, "X-Request-Trace", "Trace-Context", "REQUEST",
            source(OLD, PATH_OLD, "## HEADER X-Request-Trace"), source(NEW, PATH_NEW, "## HEADER Trace-Context"),
            json.dumps(migration)) == "MIGRATION_REVISION_MISMATCH"

def test_replay_and_invalid_paths_preserve_state(setup, direct_bob):
    vm, contract, _ = setup; create_pair(vm, contract, direct_bob); propose(vm, contract, direct_bob); mock_sources(vm); acquire_and_seal(contract, 0)
    vm.mock_llm(r"Verify one proposed HTTP header rename.*", result("valid")); contract.verify_alias(0); contract.publish_alias(0)
    before = (contract.get_pair(0), contract.get_edge(0), contract.get_counts(), contract.resolve_alias(0, "X-Request-Trace"))
    assert contract.verify_alias(0) == "EDGE_NOT_SEALED" and contract.publish_alias(0) == "EDGE_NOT_PUBLISHABLE"
    assert before == (contract.get_pair(0), contract.get_edge(0), contract.get_counts(), contract.resolve_alias(0, "X-Request-Trace"))
    with vm.prank(direct_bob): assert contract.create_version_pair("x", "v1", "v1", OWNER, REPO, "BAD") == "INVALID_PAIR"

def test_evidence_completeness_duplicate_and_post_seal_guards(setup, direct_bob):
    vm, contract, _ = setup; create_pair(vm, contract, direct_bob); propose(vm, contract, direct_bob); mock_sources(vm)
    assert contract.seal_edge(0) == "EVIDENCE_INCOMPLETE"
    assert contract.register_evidence(0, "OLD_REFERENCE") == "EVIDENCE_REGISTERED"
    old_snapshot = contract.get_evidence(0, "OLD_REFERENCE")
    assert contract.register_evidence(0, "OLD_REFERENCE") == "EVIDENCE_ALREADY_REGISTERED"
    assert contract.get_evidence(0, "OLD_REFERENCE") == old_snapshot
    assert contract.seal_edge(0) == "EVIDENCE_INCOMPLETE"
    assert contract.register_evidence(0, "NEW_REFERENCE") == "EVIDENCE_REGISTERED"
    assert contract.register_evidence(0, "MIGRATION_GUIDE") == "EVIDENCE_REGISTERED"
    assert contract.seal_edge(0) == "SEALED"
    before = (contract.get_edge(0), contract.get_evidence(0, "NEW_REFERENCE"), contract.get_counts())
    assert contract.register_evidence(0, "NEW_REFERENCE") == "EDGE_NOT_OPEN"
    assert contract.seal_edge(0) == "EDGE_NOT_OPEN"
    assert before == (contract.get_edge(0), contract.get_evidence(0, "NEW_REFERENCE"), contract.get_counts())

def test_deployer_has_no_privilege(setup, direct_bob):
    vm, contract, deployer = setup; create_pair(vm, contract, direct_bob)
    assert json.loads(contract.get_pair(0))["creator"].lower() != str(deployer).lower()
    assert "owner" not in json.loads(contract.get_counts())
