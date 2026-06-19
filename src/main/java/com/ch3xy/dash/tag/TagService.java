package com.ch3xy.dash.tag;

import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class TagService {

    private final TagRepository repository;

    public TagService(TagRepository repository) {
        this.repository = repository;
    }

    public List<TagResponse> findAll(boolean includeArchived) {
        List<Tag> tags = includeArchived
                ? repository.findAllByOrderByNameAsc()
                : repository.findAllByArchivedFalseOrderByNameAsc();
        return tags.stream().map(TagResponse::from).toList();
    }

    public TagResponse findById(UUID id) {
        return TagResponse.from(require(id));
    }

    @Transactional
    public TagResponse create(TagRequest req) {
        if (repository.existsActiveByNameIgnoreCase(req.name())) {
            throw new IllegalStateException("A tag named '" + req.name() + "' already exists");
        }
        Tag tag = new Tag();
        tag.setName(req.name());
        tag.setColor(req.color());
        return TagResponse.from(repository.save(tag));
    }

    @Transactional
    public TagResponse update(UUID id, TagRequest req) {
        Tag tag = require(id);
        if (repository.existsActiveByNameIgnoreCaseExcluding(req.name(), id)) {
            throw new IllegalStateException("A tag named '" + req.name() + "' already exists");
        }
        tag.setName(req.name());
        tag.setColor(req.color());
        return TagResponse.from(repository.save(tag));
    }

    @Transactional
    public TagResponse archive(UUID id) {
        Tag tag = require(id);
        tag.setArchived(true);
        return TagResponse.from(repository.save(tag));
    }

    private Tag require(UUID id) {
        return repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Tag not found: " + id));
    }
}
